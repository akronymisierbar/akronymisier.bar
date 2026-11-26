#!/usr/bin/env node

/**
 * Announces the newest episode once it is live: pings Overcast, posts the
 * description to Mastodon and writes the post URL into the episode file as
 * social_interact. Does nothing if the newest episode already has one.
 *
 * Usage:
 *   MASTODON_ACCESS_TOKEN=... pnpm announce
 *   pnpm announce --dry-run
 */

import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";
import { composeStatus, episodeUrl, findEpisodeToAnnounce, setSocialInteract, type Episode } from "./lib/announce.ts";
import { listEpisodeFiles, parseEpisode } from "./lib/episodes.ts";

const FEED_URL = "https://akronymisier.bar/feed.xml";
// Covers feed.xml and feed.rss, the URLs podcast apps know the feed by.
const OVERCAST_URL_PREFIX = "https://akronymisier.bar/feed.";
const MASTODON_INSTANCE = "https://chaos.social";
const MASTODON_ACCOUNT_ID = "86599"; // @akronymisierbar
// chaos.social's limit; every URL counts as 23 characters.
const MASTODON_MAX_CHARS = 500;
const MASTODON_URL_CHARS = 23;
const FEED_POLL_INTERVAL_MS = 30_000;
const FEED_POLL_TIMEOUT_MS = 20 * 60_000;

/** GitHub Pages serves cached copies for a while after a deploy, so wait until the feed shows the episode. */
async function waitForFeed(guid: string): Promise<void> {
  const deadline = Date.now() + FEED_POLL_TIMEOUT_MS;
  while (true) {
    const res = await fetch(FEED_URL, { cache: "no-store" }).catch(() => null);
    if (res?.ok && (await res.text()).includes(guid)) return;
    if (Date.now() > deadline) throw new Error(`Episode ${guid} did not appear in ${FEED_URL}`);
    console.log("  Not in the feed yet, waiting...");
    await sleep(FEED_POLL_INTERVAL_MS);
  }
}

async function pingOvercast(): Promise<void> {
  const url = `https://overcast.fm/ping?urlprefix=${encodeURIComponent(OVERCAST_URL_PREFIX)}`;
  // Overcast rate-limits pings and the feed gets crawled anyway, so a failure is not fatal.
  try {
    const res = await fetch(url);
    if (!res.ok) console.warn(`  Overcast ping failed: ${res.status} ${await res.text()}`);
  } catch (e) {
    console.warn(`  Overcast ping failed: ${e}`);
  }
}

/** A previous run may have posted and then failed, so reuse a post that already links the episode. */
async function findExistingPost(link: string): Promise<string | undefined> {
  const res = await fetch(
    `${MASTODON_INSTANCE}/api/v1/accounts/${MASTODON_ACCOUNT_ID}/statuses?limit=40&exclude_replies=true&exclude_reblogs=true`,
  );
  if (!res.ok) throw new Error(`Could not read Mastodon posts: ${res.status} ${await res.text()}`);
  const statuses = (await res.json()) as { url: string; content: string }[];
  return statuses.find((s) => s.content.includes(`href="${link}"`))?.url;
}

async function postToMastodon(status: string, idempotencyKey: string, token: string): Promise<string> {
  const res = await fetch(`${MASTODON_INSTANCE}/api/v1/statuses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Guards against duplicates when a request is retried within the hour Mastodon keeps the key.
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ status, visibility: "public", language: "de" }),
  });
  if (!res.ok) throw new Error(`Mastodon post failed: ${res.status} ${await res.text()}`);
  const { url } = (await res.json()) as { url: string };
  return url;
}

async function main() {
  const { values: args } = parseArgs({ options: { "dry-run": { type: "boolean" } } });
  const dryRun = args["dry-run"] ?? false;

  const files = new Map<string, string>();
  const episodes: Episode[] = [];
  for (const path of await listEpisodeFiles()) {
    const number = basename(path, ".md");
    const { frontmatter } = parseEpisode(await readFile(path, "utf8"));
    if (!frontmatter) continue;
    files.set(number, path);
    episodes.push({ number, frontmatter });
  }

  const episode = findEpisodeToAnnounce(episodes);
  if (!episode) {
    console.log("Newest episode is already announced.");
    return;
  }

  const status = composeStatus(episode);
  console.log(`Announcing episode ${episode.number}:\n\n${status}\n`);
  const length = [...status.replace(episodeUrl(episode), "")].length + MASTODON_URL_CHARS;
  if (length > MASTODON_MAX_CHARS) {
    throw new Error(`Post has ${length} characters, Mastodon allows ${MASTODON_MAX_CHARS}; shorten the description`);
  }
  const path = files.get(episode.number)!;
  // Fail on an unexpected file layout now rather than after the post is out.
  setSocialInteract(await readFile(path, "utf8"), "");

  if (dryRun) return;

  const token = process.env.MASTODON_ACCESS_TOKEN;
  if (!token) throw new Error("MASTODON_ACCESS_TOKEN is not set");
  const guid = episode.frontmatter.extra?.guid;
  if (!guid) throw new Error(`Episode ${episode.number} has no guid`);

  console.log("Waiting for the episode to appear in the feed...");
  await waitForFeed(guid);

  console.log("Pinging Overcast...");
  await pingOvercast();

  const existing = await findExistingPost(episodeUrl(episode));
  if (existing) {
    console.log(`Already posted: ${existing}`);
  } else {
    console.log("Posting to Mastodon...");
  }
  const postUrl = existing ?? (await postToMastodon(status, guid, token));
  console.log(`  ${postUrl}`);

  await writeFile(path, setSocialInteract(await readFile(path, "utf8"), postUrl));
  console.log(`Set social_interact in ${path}`);
}

await main();

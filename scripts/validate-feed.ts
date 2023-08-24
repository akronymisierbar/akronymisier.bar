#! /usr/bin/env deno run --allow-read --allow-net

import { parse } from "https://deno.land/x/xml@2.1.1/mod.ts";
import { Item, num } from "./types.ts";

let foundIssue = false;
function err(text: string) {
  foundIssue = true;
  console.error(" - " + text);
}

async function assertEnclosure(item: Item) {
  if (!item.enclosure["@url"].startsWith("https://kkw.lol")) {
    err(`not hosted on kkw.lol.`);
  }
  const res = await fetch(item.enclosure["@url"], {
    method: "HEAD",
  });
  const enclosureLength = item.enclosure["@length"].toString();
  const contentLength = res.headers.get("content-length");
  if (enclosureLength !== contentLength) {
    err(
      `has an enclosure length of ${enclosureLength}, but server reports ${contentLength}.`
    );
  }
}

function assertDescription(item: Item) {
  if (!item.description) {
    err(`has no description.`);
  }
  if (item.description?.length > 250) {
    err(`description is longer than 250 chars.`);
  }
  if (item.description?.trim() === item["content:encoded"]?.trim()) {
    err(`has the same value for its description and content:encoded.`);
  }
  if (item.description !== item["itunes:summary"]) {
    err(`has mismatching description and itunes:summary.`);
  }
}

function assertLink(item: Item) {
  const correctEpisodeLink = `https://akronymisier.bar/${item["itunes:episode"]
    .toString()
    .padStart(3, "0")}`;
  if (item.link !== correctEpisodeLink) {
    err(`has an invalid link '${item.link}'.`);
  }
}

function assertTitle(item: Item) {
  const titleRegex = /\d{3} - [a-zA-Z\d¯\\_(ツ)/ ]+/;
  if (!item.title.match(titleRegex)) {
    err(`has invalid format.`);
  }
  if (item.title !== item["itunes:title"]) {
    err(
      `should match itunes:title ${item["itunes:title"]}`
    );
  }
  if (item.title.slice(0, 3) !== num(item)) {
    err(`title number and episode number don't match: ${item.title.slice(0, 3)} and ${num(item)}`);
  }
}

function assertPubDate(item: Item) {
  const pubDate = new Date(item.pubDate);
  if (pubDate > new Date()) {
    err(`has a future pubDate.`);
  }
}

function assertiTunesTags(item: Item) {
  if (!item["itunes:title"]) {
    err(`has no itunes:title.`);
  }
  if (!item["itunes:author"]) {
    err(`has no itunes:author.`);
  }
  if (!item["itunes:duration"]) {
    err(`has no itunes:duration.`);
  }
  if (!item["itunes:summary"]) {
    err(`has no itunes:summary.`);
  }
  if (!item["itunes:subtitle"]) {
    err(`has no itunes:subtitle.`);
  }
  if (item["itunes:explicit"] !== false) {
    err(`has no itunes:explicit or it's set to true (lol?).`);
  }
  if (!item["itunes:episodeType"]) {
    err(`has no itunes:episodeType.`);
  }
  if (!item["itunes:episode"]) {
    err(`has no itunes:episode.`);
  }

  if (item["itunes:summary"]?.length > 250) {
    err(`itunes:summary is longer than 250 chars.`);
  }

  if (item["itunes:summary"] !== item["itunes:subtitle"]) {
    console.log(
      `itunes:summary and itunes:subtitle don't match.`
    );
  }
}

function assertEncodedContent(item: Item) {
  if (!item["content:encoded"]) {
    err(`has no content:encoded.`);
  }
  if (item["content:encoded"].includes("<h1>")) {
    err(`should not contain any <h1>s in its content.`);
  }
  if (item["content:encoded"].includes("<h2>")) {
    err(`should not contain any <h2>s in its content.`);
  }
  if (item["content:encoded"].includes("Shownotes")) {
    err(`should not contain a Shownotes header in its content.`);
  }
}

async function assertChaptermarks(item: Item) {
  const resTXT = await fetch(
    `https://kkw.lol/k/akb/${num(item)}.chapters.txt`,
    { method: "HEAD" }
  );
  if (resTXT.ok && !item["podcast:chapters"]) {
    err(`has chapter marks, but no podcast:chapters tag.`);
  }

  if (item["podcast:chapters"]) {
    const resJSON = await fetch(item["podcast:chapters"]["@url"], {
      method: "HEAD",
    });
    if (!resJSON.ok) {
      err(`lists json chapter marks, but they're not available.`);
    }
  }
}

async function assertCoverart(item: Item) {
  if (!item["itunes:image"]) {
    return;
  }
  const res = await fetch(item["itunes:image"]["@href"], { method: "HEAD" });
  if (!res.ok) {
    err(`specifies custom cover art, but the image isn't available.`);
  }
}

async function validateItem(item: Item) {
  assertDescription(item);
  assertLink(item);
  assertTitle(item);
  assertPubDate(item);
  assertiTunesTags(item);
  assertEncodedContent(item);
  await assertEnclosure(item);
  await assertChaptermarks(item);
  await assertCoverart(item);
}

if (Deno.args.length !== 1) {
  console.error("Usage: ./validate-feed.ts /path/to/feed.rss");
  Deno.exit(1);
}

const data = await Deno.readTextFile(Deno.args[0]);
const feed = parse(data);

try {
  const items = feed?.rss?.channel?.item;
  for (const item of items) {
    console.log(`${num(item)}`)
    await validateItem(item);
  }
} catch (error) {
  console.error(error);
  Deno.exit(1);
}

if (foundIssue) {
  Deno.exit(1);
}

#! /usr/bin/env deno run --allow-read --allow-net

import { parse } from "https://deno.land/x/xml@2.1.1/mod.ts";
import { Item } from "./types.ts";

let foundIssue = false;
function err(text: string) {
  foundIssue = true;
  console.error(text);
}

function num(item: Item) {
  return item["itunes:episode"].toString().padStart(3, "0");
}

async function assertEnclosure(item: Item) {
  if (!item.enclosure["@url"].startsWith("https://kkw.lol")) {
    err(`${num(item)} isn't hosted on kkw.lol.`);
  }
  const res = await fetch(item.enclosure["@url"], {
    method: "HEAD",
  });
  const enclosureLength = item.enclosure["@length"].toString();
  const contentLength = res.headers.get("content-length");
  if (enclosureLength !== contentLength) {
    err(
      `${num(item)} has an enclosure length of ${enclosureLength}, but server reports ${contentLength}.`
    );
  }
}

function assertDescription(item: Item) {
  if (!item.description) {
    err(`${num(item)} has no description.`);
  }
  if (item.description?.length > 250) {
    err(`${num(item)}'s description is longer than 250 chars.`);
  }
  if (item.description?.trim() === item["content:encoded"]?.trim()) {
    err(`${num(item)} has the same value for its description and content:encoded.`);
  }
  if (item.description !== item["itunes:summary"]) {
    err(`${num(item)} has mismatching description and itunes:summary.`);
  }
}

function assertLink(item: Item) {
  const correctEpisodeLink = `https://akronymisier.bar/${item["itunes:episode"]
    .toString()
    .padStart(3, "0")}`;
  if (item.link !== correctEpisodeLink) {
    err(`${num(item)} has an invalid link '${item.link}'.`);
  }
}

function assertTitle(item: Item) {
  const titleRegex = /\d{3} - [a-zA-Z\d¯\\_(ツ)/ ]+/;
  if (!item.title.match(titleRegex)) {
    err(`${num(item)} has invalid format.`);
  }
  if (item.title !== item["itunes:title"]) {
    err(
      `${num(item)} should match itunes:title ${item["itunes:title"]}`
    );
  }
  if (item.title.slice(0, 3) !== num(item)) {
    err(`${num(item)}'s title number and episode number don't match: ${item.title.slice(0, 3)} and ${num(item)}`);
  }
}

function assertPubDate(item: Item) {
  const pubDate = new Date(item.pubDate);
  if (pubDate > new Date()) {
    err(`${num(item)} has a future pubDate.`);
  }
}

function assertiTunesTags(item: Item) {
  if (!item["itunes:title"]) {
    err(`${num(item)} has no itunes:title.`);
  }
  if (!item["itunes:author"]) {
    err(`${num(item)} has no itunes:author.`);
  }
  if (!item["itunes:duration"]) {
    err(`${num(item)} has no itunes:duration.`);
  }
  if (!item["itunes:summary"]) {
    err(`${num(item)} has no itunes:summary.`);
  }
  if (!item["itunes:subtitle"]) {
    err(`${num(item)} has no itunes:subtitle.`);
  }
  if (item["itunes:explicit"] !== false) {
    err(`${num(item)} has no itunes:explicit or it's set to true (lol?).`);
  }
  if (!item["itunes:episodeType"]) {
    err(`${num(item)} has no itunes:episodeType.`);
  }
  if (!item["itunes:episode"]) {
    err(`${num(item)} has no itunes:episode.`);
  }

  if (item["itunes:summary"]?.length > 250) {
    err(`${num(item)}'s itunes:summary is longer than 250 chars.`);
  }

  if (item["itunes:summary"] !== item["itunes:subtitle"]) {
    console.log(
      `${num(item)}'s itunes:summary and itunes:subtitle don't match.`
    );
  }
}

function assertEncodedContent(item: Item) {
  if (!item["content:encoded"]) {
    err(`${num(item)} has no content:encoded.`);
  }
  if (item["content:encoded"].includes("<h1>")) {
    err(`${num(item)} should not contain any <h1>s in its content.`);
  }
  if (item["content:encoded"].includes("<h2>")) {
    err(`${num(item)} should not contain any <h2>s in its content.`);
  }
  if (item["content:encoded"].includes("Shownotes")) {
    err(`${num(item)} should not contain a Shownotes header in its content.`);
  }
}

async function assertChaptermarks(item: Item) {
  const resTXT = await fetch(
    `https://kkw.lol/k/akb/${num(item)}.chapters.txt`,
    { method: "HEAD" }
  );
  if (resTXT.ok && !item["podcast:chapters"]) {
    err(`${num(item)} has chapter marks, but no podcast:chapters tag.`);
  }

  if (item["podcast:chapters"]) {
    const resJSON = await fetch(item["podcast:chapters"]["@url"], {
      method: "HEAD",
    });
    if (!resJSON.ok) {
      err(`${num(item)} lists json chapter marks, but they're not available.`);
    }
  }
}

async function assertCoverart(item: Item) {
  if (!item["itunes:image"]) {
    return;
  }
  const res = await fetch(item["itunes:image"]["@href"], { method: "HEAD" });
  if (!res.ok) {
    err(`${num(item)} specifies custom cover art, but the image isn't available.`);
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
    await validateItem(item);
  }
} catch (error) {
  console.error(error);
  Deno.exit(1);
}

if (foundIssue) {
  Deno.exit(1);
}

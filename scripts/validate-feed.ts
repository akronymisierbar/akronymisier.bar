#! /usr/bin/env deno run --allow-read --allow-net

import { parse } from "https://deno.land/x/xml@2.1.1/mod.ts";

let foundIssue = false;
function err(text: string) {
  foundIssue = true;
  console.error(text);
}

// deno-lint-ignore no-explicit-any
function num(item: any) {
  return item["itunes:episode"].toString().padStart(3, "0");
}

// deno-lint-ignore no-explicit-any
function assertExistenceAndLength(item: any, tag: string, maxLength: number | undefined) {
  if (!item[tag]) {
    err(`${num(item)} has a missing or empty ${tag}.`);
    return;
  }
  if (maxLength && item[tag].length > maxLength) {
    err(`${num(item)}'s ${tag} is longer than ${maxLength} chars.`);
  }
}

// deno-lint-ignore no-explicit-any
async function assertEnclosureContentLength(item: any) {
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

// deno-lint-ignore no-explicit-any
function assertLink(item: any) {
  const correctEpisodeLink = `https://akronymisier.bar/${item["itunes:episode"]
    .toString()
    .padStart(3, "0")}`;
  if (item.link !== correctEpisodeLink) {
    err(`${num(item)} has an invalid link '${item.link}'.`);
  }
}

// deno-lint-ignore no-explicit-any
function assertTitle(item: any) {
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

// deno-lint-ignore no-explicit-any
function assertPubDate(item: any) {
  const pubDate = new Date(item.pubDate);
  if (pubDate > new Date()) {
    err(`${num(item)} has a future pubDate.`);
  }
}

// deno-lint-ignore no-explicit-any
function assertExistenceOfAlliTunesTags(item: any) {
  if (
    !item["itunes:title"] ||
    !item["itunes:author"] ||
    !item["itunes:duration"] ||
    !item["itunes:summary"] ||
    !item["itunes:subtitle"] ||
    item["itunes:explicit"] !== false ||
    !item["itunes:episodeType"] ||
    !item["itunes:episode"]
  ) {
    err(`${num(item)} doesn't have all required itunes tags.`);
  }
}

// deno-lint-ignore no-explicit-any
async function assertChaptermarks(item: any) {
  const episodeNumber = item["itunes:episode"].toString().padStart(3, "0");
  const res = await fetch(
    `https://kkw.lol/k/akb/${episodeNumber}.chapters.txt`,
    { method: "HEAD" }
  );
  if (!res.ok && !item["podcast:chapters"]) {
    err(`${num(item)} has chapter marks, but no podcast:chapters tag.`);
  }
}

// deno-lint-ignore no-explicit-any
async function validateItem(item: any) {
  assertExistenceAndLength(item, "description", 250);
  assertExistenceAndLength(item, "content:encoded", undefined);
  assertExistenceAndLength(item, "itunes:summary", 250);
  assertExistenceAndLength(item, "itunes:subtitle", 250);
  if (item["itunes:summary"] !== item["itunes:subtitle"]) {
    console.log(
      `${num(item)}'s itunes:summary and itunes:subtitle don't match.`
    );
  }
  if (item.description?.trim() === item["content:encoded"]?.trim()) {
    err(`${num(item)} has the same value for its description and content:encoded.`);
  }
  if (!item.enclosure["@url"].startsWith("https://kkw.lol")) {
    err(`${num(item)} isn't hosted on kkw.lol`);
  }
  assertLink(item);
  assertTitle(item);
  assertPubDate(item);
  assertExistenceOfAlliTunesTags(item);
  await assertEnclosureContentLength(item);
  await assertChaptermarks(item);
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

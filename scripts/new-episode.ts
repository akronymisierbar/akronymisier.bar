#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run

/**
 * CLI tool for creating new episode markdown files with auto-fetched metadata.
 *
 * Usage:
 *   deno run --allow-all scripts/new-episode.ts 062
 *   deno run --allow-all scripts/new-episode.ts --next
 */

import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts";
import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";

const EPISODES_DIR = new URL("../content/episodes", import.meta.url).pathname;
const BASE_URL = "https://kkw.lol/k/akb";

interface EpisodeMetadata {
  number: string;
  title: string;
  date: string;
  guid: string;
  duration: string;
  audioLength: number;
  description: string;
  socialInteract?: string;
  hasChapters: boolean;
  hasTranscript: boolean;
  coverImage?: string;
}

function formatEpisodeNumber(num: number): string {
  return num.toString().padStart(3, "0");
}

function generateUUID(): string {
  return crypto.randomUUID();
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

async function findNextEpisodeNumber(): Promise<number> {
  let maxNum = -1;
  for await (const entry of walk(EPISODES_DIR, { exts: [".md"], maxDepth: 1 })) {
    if (entry.name === "_index.md") continue;
    const match = entry.name.match(/^(\d+)\.md$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return maxNum + 1;
}

async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function getContentLength(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const length = res.headers.get("Content-Length");
    return length ? parseInt(length, 10) : 0;
  } catch {
    return 0;
  }
}

async function fetchChaptersJson(episodeNum: string): Promise<{ duration?: string } | null> {
  const url = `${BASE_URL}/${episodeNum}.chapters.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.chapters && data.chapters.length > 0) {
      const lastChapter = data.chapters[data.chapters.length - 1];
      return { duration: undefined };
    }
    return {};
  } catch {
    return null;
  }
}

async function tryGetDuration(episodeNum: string): Promise<string | undefined> {
  try {
    const proc = new Deno.Command("ffprobe", {
      args: [
        "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "csv=p=0",
        `${BASE_URL}/${episodeNum}.mp3`
      ],
      stdout: "piped",
      stderr: "null",
    });
    const output = await proc.output();
    if (output.success) {
      const seconds = parseFloat(new TextDecoder().decode(output.stdout).trim());
      if (!isNaN(seconds)) {
        return formatDuration(seconds);
      }
    }
  } catch {
    // ffprobe not available
  }
  return undefined;
}

async function prompt(message: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const buf = new Uint8Array(1024);

  await Deno.stdout.write(new TextEncoder().encode(`${message}${suffix}: `));
  const n = await Deno.stdin.read(buf);

  if (n === null || n === 0) {
    return defaultValue || "";
  }

  const input = new TextDecoder().decode(buf.subarray(0, n)).trim();
  return input || defaultValue || "";
}

function generateEpisodeTemplate(meta: EpisodeMetadata): string {
  let content = `+++
title = "${meta.number} - ${meta.title}"
date = ${meta.date}
template = "episode.html"
aliases = ["/${meta.number}"]
draft = false

[extra]
guid = "${meta.guid}"
duration = "${meta.duration}"
audio_length = ${meta.audioLength}
description = """${meta.description}"""
`;

  if (meta.socialInteract) {
    content += `social_interact = "${meta.socialInteract}"\n`;
  }

  content += `+++

### Links
-

### Picks

#### Kilian
-

#### Hendrik
-

### Alternative Titel
-
`;

  return content;
}

async function main() {
  const args = parse(Deno.args, {
    boolean: ["next", "help"],
    string: ["title", "description", "date", "social"],
    alias: { h: "help", n: "next", t: "title", d: "description", s: "social" },
  });

  if (args.help) {
    console.log(`
Usage: new-episode.ts [OPTIONS] [EPISODE_NUMBER]

Creates a new episode markdown file with auto-fetched metadata.

Arguments:
  EPISODE_NUMBER    Episode number (e.g., 062). If omitted, uses --next.

Options:
  -n, --next        Auto-detect next episode number
  -t, --title       Episode title (without number prefix)
  -d, --description Episode description
  --date            Publication date (YYYY-MM-DD, default: today)
  -s, --social      Mastodon post URL for social_interact
  -h, --help        Show this help message

Examples:
  new-episode.ts 062
  new-episode.ts --next
  new-episode.ts 062 --title "Episode Title" --description "About this episode"
`);
    Deno.exit(0);
  }

  let episodeNum: string;

  if (args.next || args._.length === 0) {
    const nextNum = await findNextEpisodeNumber();
    episodeNum = formatEpisodeNumber(nextNum);
    console.log(`Auto-detected next episode number: ${episodeNum}`);
  } else {
    const num = parseInt(args._[0].toString(), 10);
    if (isNaN(num)) {
      console.error("Error: Episode number must be a valid integer");
      Deno.exit(1);
    }
    episodeNum = formatEpisodeNumber(num);
  }

  console.log(`\nCreating episode ${episodeNum}...`);
  console.log(`Checking remote files at ${BASE_URL}/${episodeNum}.*\n`);

  // Check for required files
  const mp3Url = `${BASE_URL}/${episodeNum}.mp3`;
  const mp3Exists = await checkUrlExists(mp3Url);
  if (!mp3Exists) {
    console.error(`Warning: MP3 not found at ${mp3Url}`);
  }

  // Get audio length
  console.log("Fetching MP3 metadata...");
  const audioLength = await getContentLength(mp3Url);
  if (audioLength > 0) {
    console.log(`  Audio size: ${(audioLength / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.log("  Could not determine audio size");
  }

  // Try to get duration via ffprobe
  console.log("Checking duration (requires ffprobe)...");
  let duration = await tryGetDuration(episodeNum);
  if (duration) {
    console.log(`  Duration: ${duration}`);
  } else {
    console.log("  Could not determine duration automatically");
  }

  // Check for chapters
  console.log("Checking for chapter marks...");
  const chaptersJsonExists = await checkUrlExists(`${BASE_URL}/${episodeNum}.chapters.json`);
  const chaptersTxtExists = await checkUrlExists(`${BASE_URL}/${episodeNum}.chapters.txt`);
  const hasChapters = chaptersJsonExists || chaptersTxtExists;
  if (hasChapters) {
    console.log(`  Chapters found: ${chaptersJsonExists ? ".chapters.json" : ".chapters.txt"}`);
  } else {
    console.log("  No chapter marks found");
  }

  // Check for transcript
  console.log("Checking for transcript...");
  const hasTranscript = await checkUrlExists(`${BASE_URL}/${episodeNum}.vtt`);
  if (hasTranscript) {
    console.log("  Transcript found: .vtt");
  } else {
    console.log("  No transcript found");
  }

  // Check for cover image
  console.log("Checking for cover image...");
  const jpgExists = await checkUrlExists(`${BASE_URL}/${episodeNum}.jpg`);
  const pngExists = await checkUrlExists(`${BASE_URL}/${episodeNum}.png`);
  const coverImage = jpgExists ? `${episodeNum}.jpg` : (pngExists ? `${episodeNum}.png` : undefined);
  if (coverImage) {
    console.log(`  Cover image found: ${coverImage}`);
  } else {
    console.log("  No cover image found (will use default logo)");
  }

  console.log("");

  // Get user input for missing fields (skip prompts if all required args provided)
  let title: string;
  let description: string;
  let socialInteract: string | undefined;

  if (args.title && args.description) {
    title = args.title;
    description = args.description;
    socialInteract = args.social || undefined;
  } else {
    title = args.title || await prompt("Episode title (without number prefix)");
    description = args.description || await prompt("Episode description");

    if (!duration) {
      duration = await prompt("Duration (HH:MM:SS)", "00:00:00");
    }

    socialInteract = args.social || await prompt("Mastodon post URL (optional, press Enter to skip)") || undefined;
  }

  const date = args.date || new Date().toISOString().split("T")[0];

  const meta: EpisodeMetadata = {
    number: episodeNum,
    title: title || "Untitled",
    date,
    guid: generateUUID(),
    duration,
    audioLength,
    description: description || "",
    socialInteract: socialInteract || undefined,
    hasChapters,
    hasTranscript,
    coverImage,
  };

  // Generate and write file
  const template = generateEpisodeTemplate(meta);
  const outputPath = `${EPISODES_DIR}/${episodeNum}.md`;

  // Check if file already exists
  try {
    await Deno.stat(outputPath);
    const overwrite = await prompt(`File ${outputPath} already exists. Overwrite? (y/N)`, "n");
    if (overwrite.toLowerCase() !== "y") {
      console.log("Aborted.");
      Deno.exit(0);
    }
  } catch {
    // File doesn't exist, proceed
  }

  await Deno.writeTextFile(outputPath, template);

  console.log(`\nEpisode file created: ${outputPath}`);
  console.log(`
Next steps:
  1. Edit ${outputPath} to add shownotes
  2. Run 'zola build' to generate the site
  3. Create a PR to publish the episode
`);
}

main();

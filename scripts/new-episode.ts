#!/usr/bin/env node

/**
 * CLI tool for creating new episode markdown files with auto-fetched metadata.
 *
 * Usage:
 *   pnpm new-episode 062
 *   pnpm new-episode --next
 */

import { execFile } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createInterface, type Interface } from "node:readline";
import { parseArgs, promisify } from "node:util";
import {
  EPISODES_DIR,
  MEDIA_BASE_URL as BASE_URL,
  checkUrlExists,
  getContentLength,
  listEpisodeFiles,
} from "./lib/episodes.ts";

interface EpisodeMetadata {
  number: string;
  title: string;
  date: string;
  guid: string;
  duration: string;
  audioLength: number;
  description: string;
  socialInteract?: string;
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
  const numbers = (await listEpisodeFiles()).map((f) => parseInt(basename(f, ".md"), 10));
  return Math.max(-1, ...numbers) + 1;
}

async function tryGetDuration(episodeNum: string): Promise<string | undefined> {
  try {
    const { stdout } = await promisify(execFile)("ffprobe", [
      "-v", "quiet",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      `${BASE_URL}/${episodeNum}.mp3`,
    ]);
    const seconds = parseFloat(stdout.trim());
    if (!isNaN(seconds)) return formatDuration(seconds);
  } catch {
    // ffprobe not available or the MP3 is missing
  }
  return undefined;
}

// One shared reader, created on first use: separate readline instances would each
// buffer and lose piped input, and an open one keeps the process alive.
let stdin: Interface | undefined;
let stdinLines: AsyncIterator<string> | undefined;

async function prompt(message: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  process.stdout.write(`${message}${suffix}: `);
  stdin ??= createInterface({ input: process.stdin });
  stdinLines ??= stdin[Symbol.asyncIterator]();
  const { value, done } = await stdinLines.next();
  const input = done ? "" : value.trim();
  return input || defaultValue || "";
}

function generateEpisodeTemplate(meta: EpisodeMetadata): string {
  let content = `+++
title = ${JSON.stringify(`${meta.number} - ${meta.title}`)}
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
  if (meta.coverImage) {
    content += `cover_image = "${BASE_URL}/${meta.coverImage}"\n`;
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
  const { values: args, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      next: { type: "boolean", short: "n" },
      help: { type: "boolean", short: "h" },
      title: { type: "string", short: "t" },
      description: { type: "string", short: "d" },
      date: { type: "string" },
      social: { type: "string", short: "s" },
    },
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
    process.exit(0);
  }

  let episodeNum: string;

  if (args.next || positionals.length === 0) {
    const nextNum = await findNextEpisodeNumber();
    episodeNum = formatEpisodeNumber(nextNum);
    console.log(`Auto-detected next episode number: ${episodeNum}`);
  } else {
    const num = parseInt(positionals[0], 10);
    if (isNaN(num)) {
      console.error("Error: Episode number must be a valid integer");
      process.exit(1);
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
  if (chaptersJsonExists || chaptersTxtExists) {
    console.log(`  Chapters found: ${chaptersJsonExists ? ".chapters.json" : ".chapters.txt"}`);
  } else {
    console.log("  No chapter marks found");
  }

  // Check for transcript
  console.log("Checking for transcript...");
  if (await checkUrlExists(`${BASE_URL}/${episodeNum}.vtt`)) {
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
    duration: duration ?? "00:00:00",
    audioLength,
    description: description || "",
    socialInteract: socialInteract || undefined,
    coverImage,
  };

  // Generate and write file
  const template = generateEpisodeTemplate(meta);
  const outputPath = join(EPISODES_DIR, `${episodeNum}.md`);

  // Check if file already exists
  const exists = await access(outputPath).then(() => true, () => false);
  if (exists) {
    const overwrite = await prompt(`File ${outputPath} already exists. Overwrite? (y/N)`, "n");
    if (overwrite.toLowerCase() !== "y") {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  await writeFile(outputPath, template);

  console.log(`\nEpisode file created: ${outputPath}`);
  console.log(`
Next steps:
  1. Edit ${outputPath} to add shownotes
  2. Run 'zola build' to generate the site
  3. Create a PR to publish the episode
`);
}

await main();
stdin?.close();

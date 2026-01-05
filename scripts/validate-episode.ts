#!/usr/bin/env -S deno run --allow-read --allow-net

/**
 * Validates episode markdown files for the Akronymisierbar podcast.
 * Checks frontmatter, media file existence, and metadata consistency.
 *
 * Usage:
 *   deno run --allow-read --allow-net scripts/validate-episode.ts
 *   deno run --allow-read --allow-net scripts/validate-episode.ts 060.md 061.md
 */

import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts";
import { parse } from "https://deno.land/std@0.208.0/toml/parse.ts";

const EPISODES_DIR = new URL("../content/episodes", import.meta.url).pathname;
const BASE_URL = "https://kkw.lol/k/akb";

interface ValidationError {
  file: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

interface EpisodeFrontmatter {
  title?: string;
  date?: string;
  template?: string;
  aliases?: string[];
  draft?: boolean;
  extra?: {
    guid?: string;
    duration?: string;
    audio_length?: number;
    description?: string;
    social_interact?: string;
    cover_image?: string;
    audio_url?: string;
    chapters_url?: string;
    transcript_vtt?: string;
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DURATION_REGEX = /^\d{2}:\d{2}:\d{2}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

function parseFrontmatter(content: string): { frontmatter: EpisodeFrontmatter | null; body: string } {
  const match = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: null, body: content };
  }

  try {
    const frontmatter = parse(match[1]) as EpisodeFrontmatter;
    return { frontmatter, body: match[2] };
  } catch {
    return { frontmatter: null, body: content };
  }
}

async function validateEpisode(filePath: string, checkRemote: boolean): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const fileName = filePath.split("/").pop() || "";

  const content = await Deno.readTextFile(filePath);
  const { frontmatter } = parseFrontmatter(content);

  if (!frontmatter) {
    errors.push({
      file: fileName,
      field: "frontmatter",
      message: "Could not parse TOML frontmatter",
      severity: "error",
    });
    return errors;
  }

  // Required fields
  if (!frontmatter.title) {
    errors.push({
      file: fileName,
      field: "title",
      message: "Missing required field: title",
      severity: "error",
    });
  }

  if (!frontmatter.date) {
    errors.push({
      file: fileName,
      field: "date",
      message: "Missing required field: date",
      severity: "error",
    });
  } else if (typeof frontmatter.date === "string" && !DATE_REGEX.test(frontmatter.date)) {
    errors.push({
      file: fileName,
      field: "date",
      message: `Invalid date format: ${frontmatter.date} (expected YYYY-MM-DD)`,
      severity: "error",
    });
  }

  if (!frontmatter.template) {
    errors.push({
      file: fileName,
      field: "template",
      message: "Missing required field: template",
      severity: "warning",
    });
  }

  if (!frontmatter.aliases || frontmatter.aliases.length === 0) {
    errors.push({
      file: fileName,
      field: "aliases",
      message: "Missing aliases (needed for URL redirects)",
      severity: "warning",
    });
  }

  // Extra fields
  const extra = frontmatter.extra || {};

  if (!extra.guid) {
    errors.push({
      file: fileName,
      field: "extra.guid",
      message: "Missing required field: extra.guid",
      severity: "error",
    });
  } else if (!UUID_REGEX.test(extra.guid) && !extra.guid.startsWith("tag:")) {
    errors.push({
      file: fileName,
      field: "extra.guid",
      message: `Invalid GUID format: ${extra.guid}`,
      severity: "warning",
    });
  }

  if (!extra.duration) {
    errors.push({
      file: fileName,
      field: "extra.duration",
      message: "Missing required field: extra.duration",
      severity: "error",
    });
  } else if (!DURATION_REGEX.test(extra.duration)) {
    errors.push({
      file: fileName,
      field: "extra.duration",
      message: `Invalid duration format: ${extra.duration} (expected HH:MM:SS)`,
      severity: "error",
    });
  }

  if (!extra.audio_length || extra.audio_length <= 0) {
    errors.push({
      file: fileName,
      field: "extra.audio_length",
      message: "Missing or invalid audio_length",
      severity: "error",
    });
  }

  if (extra.description === undefined) {
    errors.push({
      file: fileName,
      field: "extra.description",
      message: "Missing required field: extra.description (can be empty string)",
      severity: "error",
    });
  }

  // Remote file checks (optional, can be slow)
  if (checkRemote) {
    const episodeNum = fileName.replace(".md", "");

    // Check MP3 exists
    const mp3Url = extra.audio_url || `${BASE_URL}/${episodeNum}.mp3`;
    const mp3Exists = await checkUrlExists(mp3Url);
    if (!mp3Exists) {
      errors.push({
        file: fileName,
        field: "mp3",
        message: `MP3 not found at: ${mp3Url}`,
        severity: "error",
      });
    } else if (extra.audio_length) {
      // Verify audio_length matches
      const actualLength = await getContentLength(mp3Url);
      if (actualLength > 0 && actualLength !== extra.audio_length) {
        const diff = Math.abs(actualLength - extra.audio_length);
        if (diff > 1000) {
          errors.push({
            file: fileName,
            field: "extra.audio_length",
            message: `audio_length mismatch: expected ${extra.audio_length}, got ${actualLength}`,
            severity: "warning",
          });
        }
      }
    }

    // Check cover image exists
    const jpgExists = await checkUrlExists(`${BASE_URL}/${episodeNum}.jpg`);
    const pngExists = await checkUrlExists(`${BASE_URL}/${episodeNum}.png`);
    if (!jpgExists && !pngExists && !extra.cover_image) {
      errors.push({
        file: fileName,
        field: "cover",
        message: `No cover image found at ${BASE_URL}/${episodeNum}.{jpg,png}`,
        severity: "warning",
      });
    }
  }

  return errors;
}

async function main() {
  const args = Deno.args;
  const checkRemote = !args.includes("--skip-remote");
  const files = args.filter(a => a.endsWith(".md"));

  console.log("Validating episode files...\n");
  if (!checkRemote) {
    console.log("(Skipping remote file checks)\n");
  }

  let allErrors: ValidationError[] = [];

  if (files.length > 0) {
    for (const file of files) {
      const filePath = file.includes("/") ? file : `${EPISODES_DIR}/${file}`;
      const errors = await validateEpisode(filePath, checkRemote);
      allErrors = allErrors.concat(errors);
    }
  } else {
    for await (const entry of walk(EPISODES_DIR, { exts: [".md"], maxDepth: 1 })) {
      if (entry.name === "_index.md") continue;
      const errors = await validateEpisode(entry.path, checkRemote);
      allErrors = allErrors.concat(errors);
    }
  }

  // Group errors by file
  const errorsByFile = new Map<string, ValidationError[]>();
  for (const error of allErrors) {
    const existing = errorsByFile.get(error.file) || [];
    existing.push(error);
    errorsByFile.set(error.file, existing);
  }

  // Print results
  let hasErrors = false;
  let hasWarnings = false;

  for (const [file, errors] of errorsByFile) {
    console.log(`\n${file}:`);
    for (const error of errors) {
      const prefix = error.severity === "error" ? "  ERROR" : "  WARN ";
      console.log(`${prefix} [${error.field}] ${error.message}`);

      if (error.severity === "error") hasErrors = true;
      if (error.severity === "warning") hasWarnings = true;
    }
  }

  if (allErrors.length === 0) {
    console.log("All episodes validated successfully!");
  } else {
    console.log(`\n---`);
    console.log(`Total: ${allErrors.filter(e => e.severity === "error").length} errors, ${allErrors.filter(e => e.severity === "warning").length} warnings`);
  }

  // Exit with error code if there are errors
  if (hasErrors) {
    Deno.exit(1);
  }
}

main();

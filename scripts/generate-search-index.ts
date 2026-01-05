#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net

/**
 * Generates a search index from episode metadata and VTT transcripts.
 * Transcripts are fetched from kkw.lol during build.
 * The index is used for client-side full-text search.
 *
 * Usage:
 *   deno run --allow-read --allow-write --allow-net scripts/generate-search-index.ts
 */

import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts";
import { parse } from "https://deno.land/std@0.208.0/toml/parse.ts";

const EPISODES_DIR = new URL("../content/episodes", import.meta.url).pathname;
const TRANSCRIPT_BASE_URL = "https://kkw.lol/k/akb";
const OUTPUT_FILE = new URL("../static/search-index.json", import.meta.url).pathname;

interface EpisodeFrontmatter {
  title?: string;
  date?: string | Date;
  extra?: {
    duration?: string;
    description?: string;
  };
}

interface EpisodeMetadata {
  i: string;      // id
  t: string;      // title
  d: string;      // description
  p: string;      // published date
  u: string;      // url
  l: string;      // length (duration)
}

interface TranscriptSegment {
  e: string;      // episodeId
  s: number;      // startTime
  n: number;      // endTime (n for end)
  t: string;      // text
}

interface SearchIndex {
  version: number;
  generated: string;
  episodes: EpisodeMetadata[];
  segments: TranscriptSegment[];
}

interface VttCue {
  startTime: number;
  endTime: number;
  text: string;
}

function parseFrontmatter(content: string): EpisodeFrontmatter | null {
  const match = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+/);
  if (!match) return null;

  try {
    return parse(match[1]) as EpisodeFrontmatter;
  } catch {
    return null;
  }
}

function parseTimestamp(ts: string): number {
  const parts = ts.trim().split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts.map(parseFloat);
    return h * 3600 + m * 60 + s;
  }
  return 0;
}

function parseVtt(content: string): VttCue[] {
  const lines = content.split("\n");
  const cues: VttCue[] = [];
  let currentCue: Partial<VttCue> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes("-->")) {
      const [start, end] = trimmed.split("-->").map(parseTimestamp);
      currentCue = { startTime: start, endTime: end, text: "" };
    } else if (currentCue && trimmed === "") {
      if (currentCue.text) {
        cues.push(currentCue as VttCue);
      }
      currentCue = null;
    } else if (currentCue && trimmed !== "" && !trimmed.startsWith("WEBVTT")) {
      currentCue.text = ((currentCue.text || "") + " " + trimmed).trim();
    }
  }

  if (currentCue?.text) {
    cues.push(currentCue as VttCue);
  }

  return cues;
}

function consolidateCues(cues: VttCue[], targetDuration: number = 30): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let current: { startTime: number; endTime: number; texts: string[] } | null = null;

  for (const cue of cues) {
    if (!current) {
      current = { startTime: cue.startTime, endTime: cue.endTime, texts: [cue.text] };
    } else if (cue.endTime - current.startTime <= targetDuration) {
      current.endTime = cue.endTime;
      current.texts.push(cue.text);
    } else {
      segments.push({
        e: "",
        s: Math.floor(current.startTime),
        n: Math.ceil(current.endTime),
        t: current.texts.join(" "),
      });
      current = { startTime: cue.startTime, endTime: cue.endTime, texts: [cue.text] };
    }
  }

  if (current) {
    segments.push({
      e: "",
      s: Math.floor(current.startTime),
      n: Math.ceil(current.endTime),
      t: current.texts.join(" "),
    });
  }

  return segments;
}

function getTranscriptUrl(episodeId: string): string {
  return `${TRANSCRIPT_BASE_URL}/${episodeId}.vtt`;
}

async function fetchTranscript(episodeId: string): Promise<string | null> {
  const url = getTranscriptUrl(episodeId);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

function formatDate(date: string | Date): string {
  if (date instanceof Date) {
    return date.toISOString().split("T")[0];
  }
  return String(date).split("T")[0];
}

async function main() {
  console.log("Generating search index...\n");
  console.log("Fetching transcripts from kkw.lol...\n");

  const index: SearchIndex = {
    version: 1,
    generated: new Date().toISOString(),
    episodes: [],
    segments: [],
  };

  interface EpisodeEntry {
    episodeId: string;
    frontmatter: EpisodeFrontmatter;
  }

  const episodeEntries: EpisodeEntry[] = [];

  for await (const entry of walk(EPISODES_DIR, { exts: [".md"], maxDepth: 1 })) {
    if (entry.name === "_index.md") continue;

    const episodeId = entry.name.replace(".md", "");
    const content = await Deno.readTextFile(entry.path);
    const frontmatter = parseFrontmatter(content);

    if (!frontmatter?.title || !frontmatter?.date) {
      console.log(`  Skipping ${entry.name}: missing required frontmatter`);
      continue;
    }

    episodeEntries.push({ episodeId, frontmatter });
  }

  const transcriptResults = await Promise.all(
    episodeEntries.map(async ({ episodeId }) => {
      const vttContent = await fetchTranscript(episodeId);
      return { episodeId, vttContent };
    })
  );

  const transcriptMap = new Map<string, string | null>();
  for (const { episodeId, vttContent } of transcriptResults) {
    transcriptMap.set(episodeId, vttContent);
  }

  let transcriptsProcessed = 0;
  let segmentsCreated = 0;

  for (const { episodeId, frontmatter } of episodeEntries) {
    const episode: EpisodeMetadata = {
      i: episodeId,
      t: frontmatter.title!,
      d: frontmatter.extra?.description || "",
      p: formatDate(frontmatter.date!),
      u: `/episodes/${episodeId}/`,
      l: frontmatter.extra?.duration || "",
    };
    index.episodes.push(episode);

    const vttContent = transcriptMap.get(episodeId);
    if (vttContent) {
      const cues = parseVtt(vttContent);
      const segments = consolidateCues(cues);

      for (const segment of segments) {
        segment.e = episodeId;
        index.segments.push(segment);
        segmentsCreated++;
      }
      transcriptsProcessed++;
      console.log(`  ${episodeId}: ${cues.length} cues -> ${segments.length} segments`);
    } else {
      console.log(`  ${episodeId}: No transcript found`);
    }
  }

  index.episodes.sort((a, b) => b.p.localeCompare(a.p));

  await Deno.writeTextFile(OUTPUT_FILE, JSON.stringify(index));

  const stats = await Deno.stat(OUTPUT_FILE);
  const sizeKb = (stats.size / 1024).toFixed(1);

  console.log(`\n---`);
  console.log(`Episodes processed: ${episodeEntries.length}`);
  console.log(`Transcripts fetched: ${transcriptsProcessed}`);
  console.log(`Segments created: ${segmentsCreated}`);
  console.log(`Index size: ${sizeKb} KB`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main();

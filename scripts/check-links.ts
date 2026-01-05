#!/usr/bin/env -S deno run --allow-read --allow-net --allow-run

/**
 * Checks for dead links in episode markdown files.
 *
 * Usage:
 *   deno run --allow-read --allow-net --allow-run scripts/check-links.ts
 *   deno run --allow-read --allow-net --allow-run scripts/check-links.ts 060.md 061.md
 *   deno run --allow-read --allow-net --allow-run scripts/check-links.ts --changed-only
 */

import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts";

const EPISODES_DIR = new URL("../content/episodes", import.meta.url).pathname;
const TIMEOUT_MS = 10000;
const CONCURRENT_REQUESTS = 5;

interface LinkResult {
  url: string;
  status: "ok" | "error" | "timeout" | "redirect";
  statusCode?: number;
  redirectUrl?: string;
  error?: string;
}

interface EpisodeResult {
  file: string;
  links: LinkResult[];
}

function extractUrls(content: string): string[] {
  // Extract URLs from markdown links [text](url) and bare URLs
  const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  const bareUrlRegex = /(?<![[(])https?:\/\/[^\s<>"')\]]+/g;

  const urls = new Set<string>();

  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const url = match[2].trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      urls.add(url);
    }
  }

  while ((match = bareUrlRegex.exec(content)) !== null) {
    urls.add(match[0]);
  }

  return [...urls];
}

function parseFrontmatter(content: string): { body: string } {
  const match = content.match(/^\+\+\+\n[\s\S]*?\n\+\+\+\n([\s\S]*)$/);
  if (!match) {
    return { body: content };
  }
  return { body: match[1] };
}

async function checkUrl(url: string): Promise<LinkResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
    });

    clearTimeout(timeoutId);

    if (res.status >= 300 && res.status < 400) {
      const redirectUrl = res.headers.get("location");
      return {
        url,
        status: "redirect",
        statusCode: res.status,
        redirectUrl: redirectUrl || undefined,
      };
    }

    if (!res.ok) {
      return {
        url,
        status: "error",
        statusCode: res.status,
      };
    }

    return { url, status: "ok", statusCode: res.status };
  } catch (e) {
    clearTimeout(timeoutId);

    if (e instanceof DOMException && e.name === "AbortError") {
      return { url, status: "timeout" };
    }

    return {
      url,
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkUrlsWithConcurrency(
  urls: string[],
  concurrency: number
): Promise<LinkResult[]> {
  const results: LinkResult[] = [];
  const queue = [...urls];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (url) {
        const result = await checkUrl(url);
        results.push(result);
      }
    }
  }

  const workers = Array(Math.min(concurrency, urls.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

async function checkEpisode(filePath: string): Promise<EpisodeResult> {
  const content = await Deno.readTextFile(filePath);
  const { body } = parseFrontmatter(content);
  const urls = extractUrls(body);
  const fileName = filePath.split("/").pop() || filePath;

  if (urls.length === 0) {
    return { file: fileName, links: [] };
  }

  const results = await checkUrlsWithConcurrency(urls, CONCURRENT_REQUESTS);
  return { file: fileName, links: results };
}

async function getChangedEpisodes(): Promise<string[]> {
  const process = new Deno.Command("git", {
    args: [
      "diff",
      "--name-only",
      "--diff-filter=ACMR",
      "origin/main...HEAD",
      "--",
      "content/episodes/*.md",
    ],
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout } = await process.output();
  const output = new TextDecoder().decode(stdout).trim();

  if (!output) {
    return [];
  }

  return output.split("\n").filter((f) => f.endsWith(".md"));
}

async function main() {
  const args = Deno.args;
  const changedOnly = args.includes("--changed-only");
  const specificFiles = args.filter(
    (a) => a.endsWith(".md") && !a.startsWith("--")
  );

  let filesToCheck: string[] = [];

  if (changedOnly) {
    const changed = await getChangedEpisodes();
    if (changed.length === 0) {
      console.log("No changed episode files found.");
      return;
    }
    filesToCheck = changed.map((f) =>
      f.startsWith("content/") ? f : `content/episodes/${f}`
    );
    console.log(`Checking ${filesToCheck.length} changed episode(s)...\n`);
  } else if (specificFiles.length > 0) {
    filesToCheck = specificFiles.map((f) =>
      f.includes("/") ? f : `${EPISODES_DIR}/${f}`
    );
    console.log(`Checking ${filesToCheck.length} specified episode(s)...\n`);
  } else {
    for await (const entry of walk(EPISODES_DIR, { exts: [".md"], maxDepth: 1 })) {
      if (entry.name === "_index.md") continue;
      filesToCheck.push(entry.path);
    }
    console.log(`Checking all ${filesToCheck.length} episodes...\n`);
  }

  let totalBroken = 0;
  const allResults: EpisodeResult[] = [];

  for (const file of filesToCheck) {
    const result = await checkEpisode(file);
    allResults.push(result);

    const broken = result.links.filter(
      (l) => l.status === "error" || l.status === "timeout"
    );

    if (broken.length > 0) {
      console.log(`${result.file}:`);
      for (const link of broken) {
        if (link.status === "timeout") {
          console.log(`  TIMEOUT: ${link.url}`);
        } else if (link.statusCode) {
          console.log(`  ${link.statusCode}: ${link.url}`);
        } else {
          console.log(`  ERROR: ${link.url} - ${link.error}`);
        }
      }
      console.log();
      totalBroken += broken.length;
    }
  }

  const totalLinks = allResults.reduce((sum, r) => sum + r.links.length, 0);
  const okLinks = allResults.reduce(
    (sum, r) => sum + r.links.filter((l) => l.status === "ok" || l.status === "redirect").length,
    0
  );

  console.log("---");
  console.log(`Checked ${totalLinks} links across ${filesToCheck.length} episodes`);
  console.log(`${okLinks} OK, ${totalBroken} broken`);

  if (totalBroken > 0) {
    Deno.exit(1);
  }
}

main();

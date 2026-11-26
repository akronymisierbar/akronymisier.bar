#!/usr/bin/env node

/**
 * Checks for dead links in episode markdown files.
 *
 * Usage:
 *   pnpm check-links
 *   pnpm check-links 060.md 061.md
 *   pnpm check-links --changed-only
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { EPISODES_DIR, listEpisodeFiles, parseEpisode } from "./lib/episodes.ts";

const TIMEOUT_MS = 10000;
const CONCURRENT_REQUESTS = 5;
// Some servers reject requests without a browser user agent.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const KNOWN_DEAD_LINKS_FILE = join(import.meta.dirname, "known-dead-links.txt");

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

const SKIP_DOMAINS = [
  // Always reports 503, and also we don't need to hammer a good service.
  "xcancel.com",
];

/** Dead links with no archived copy to point to; reporting them again would only add noise. */
const knownDeadLinks = new Set(
  (await readFile(KNOWN_DEAD_LINKS_FILE, "utf8"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#")),
);

function shouldSkipUrl(url: string): boolean {
  if (knownDeadLinks.has(url)) return true;
  try {
    const hostname = new URL(url).hostname;
    return SKIP_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function extractUrls(content: string): string[] {
  const urls = new Set<string>();

  // Match [text](<url>) - angle bracket syntax for URLs with special chars
  const angleBracketLinkRegex = /\[[^\]]*\]\(<([^>]+)>\)/g;
  let match;
  while ((match = angleBracketLinkRegex.exec(content)) !== null) {
    const url = match[1].trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (!shouldSkipUrl(url)) {
        urls.add(url);
      }
    }
  }

  // Match [text](url) - standard markdown links (no nested parens)
  const standardLinkRegex = /\[[^\]]*\]\(([^)<>\s][^)\s]*)\)/g;
  while ((match = standardLinkRegex.exec(content)) !== null) {
    const url = match[1].trim();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (!shouldSkipUrl(url)) {
        urls.add(url);
      }
    }
  }

  // Match bare URLs not inside markdown link syntax or nested in another URL (Wayback snapshots)
  const bareUrlRegex = /(?<![[(/])https?:\/\/[^\s<>"'`\]]+/g;
  while ((match = bareUrlRegex.exec(content)) !== null) {
    const url = match[0];
    if (!shouldSkipUrl(url)) {
      urls.add(url);
    }
  }

  return [...urls];
}

async function request(url: string, method: "HEAD" | "GET"): Promise<LinkResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
    await res.body?.cancel();

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
      return { url, status: "error", statusCode: res.status };
    }

    return { url, status: "ok", statusCode: res.status };
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      return { url, status: "timeout" };
    }

    return {
      url,
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function checkUrl(url: string): Promise<LinkResult> {
  const head = await request(url, "HEAD");
  // Many servers mishandle HEAD (405, 403, resets), so confirm a failure with GET unless the page is clearly gone.
  const clearlyGone = head.statusCode === 404 || head.statusCode === 410;
  if (head.status === "ok" || head.status === "redirect" || clearlyGone) return head;
  return request(url, "GET");
}

async function checkUrlsWithConcurrency(
  urls: string[],
  concurrency: number,
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
  const { body } = parseEpisode(await readFile(filePath, "utf8"));
  const urls = extractUrls(body);
  const fileName = basename(filePath);

  if (urls.length === 0) {
    return { file: fileName, links: [] };
  }

  const results = await checkUrlsWithConcurrency(urls, CONCURRENT_REQUESTS);
  return { file: fileName, links: results };
}

async function getChangedEpisodes(): Promise<string[]> {
  const { stdout } = await promisify(execFile)("git", [
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    "origin/main...HEAD",
    "--",
    "content/episodes/*.md",
  ]);
  const output = stdout.trim();

  if (!output) {
    return [];
  }

  return output.split("\n").filter((f) => f.endsWith(".md"));
}

async function main() {
  const args = process.argv.slice(2);
  const changedOnly = args.includes("--changed-only");
  const specificFiles = args.filter(
    (a) => a.endsWith(".md") && !a.startsWith("--"),
  );

  let filesToCheck: string[] = [];

  if (changedOnly) {
    const changed = await getChangedEpisodes();
    if (changed.length === 0) {
      console.log("No changed episode files found.");
      return;
    }
    filesToCheck = changed.map((f) =>
      f.startsWith("content/") ? f : `content/episodes/${f}`,
    );
    console.log(`Checking ${filesToCheck.length} changed episode(s)...\n`);
  } else if (specificFiles.length > 0) {
    filesToCheck = specificFiles.map((f) =>
      f.includes("/") ? f : join(EPISODES_DIR, f),
    );
    console.log(`Checking ${filesToCheck.length} specified episode(s)...\n`);
  } else {
    filesToCheck = await listEpisodeFiles();
    console.log(`Checking all ${filesToCheck.length} episodes...\n`);
  }

  let totalBroken = 0;
  const allResults: EpisodeResult[] = [];

  for (const file of filesToCheck) {
    const result = await checkEpisode(file);
    allResults.push(result);

    const broken = result.links.filter(
      (l) => l.status === "error" || l.status === "timeout",
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
    (sum, r) =>
      sum +
      r.links.filter((l) => l.status === "ok" || l.status === "redirect")
        .length,
    0,
  );

  console.log("---");
  console.log(
    `Checked ${totalLinks} links across ${filesToCheck.length} episodes`,
  );
  console.log(`${okLinks} OK, ${totalBroken} broken`);

  if (totalBroken > 0) {
    process.exit(1);
  }
}

await main();

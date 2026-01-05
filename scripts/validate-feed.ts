#!/usr/bin/env -S deno run --allow-read

/**
 * Validates the built RSS feed for podcast requirements.
 * Based on Podbase validator checks:
 * - Basics: XML well-formed, RSS 2.0 compliant
 * - Apple Podcasts: required elements for iTunes
 * - PSP-1: Podcast Standards Project compliance
 */

import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";

const FEED_PATH = new URL("../public/feed.xml", import.meta.url).pathname;

interface ValidationError {
  category: string;
  message: string;
  severity: "error" | "warning";
}

// deno-lint-ignore no-explicit-any
function getElement(parent: any, name: string): any {
  if (!parent) return null;
  if (Array.isArray(parent)) {
    return parent.find((p) => p && p[name])?.[name];
  }
  return parent[name];
}

// deno-lint-ignore no-explicit-any
function getText(parent: any, name: string): string | null {
  const elem = getElement(parent, name);
  if (!elem) return null;
  if (typeof elem === "string") return elem;
  if (elem["#text"]) return elem["#text"];
  return null;
}

// deno-lint-ignore no-explicit-any
function getAttr(parent: any, name: string, attr: string): string | null {
  const elem = getElement(parent, name);
  if (!elem) return null;
  return elem[`@${attr}`] || null;
}

async function main() {
  const errors: ValidationError[] = [];

  let content: string;
  try {
    content = await Deno.readTextFile(FEED_PATH);
  } catch {
    console.error(`Error: Could not read ${FEED_PATH}`);
    console.error("Make sure to run 'zola build' first.");
    Deno.exit(1);
  }

  // === BASICS ===

  // Is it XML?
  // deno-lint-ignore no-explicit-any
  let doc: any;
  try {
    doc = parse(content);
  } catch (e) {
    errors.push({
      category: "Basics",
      message: `Not valid XML: ${e}`,
      severity: "error",
    });
    printResults(errors);
    Deno.exit(1);
  }

  // Is it RSS?
  if (!doc?.rss) {
    errors.push({
      category: "Basics",
      message: "Not an RSS feed (missing <rss> element)",
      severity: "error",
    });
    printResults(errors);
    Deno.exit(1);
  }

  const channel = doc.rss.channel;
  if (!channel) {
    errors.push({
      category: "Basics",
      message: "Missing <channel> element",
      severity: "error",
    });
    printResults(errors);
    Deno.exit(1);
  }

  // === RSS 2.0 REQUIRED CHANNEL ELEMENTS ===

  const rssRequiredChannel = ["title", "link", "description"];
  for (const elem of rssRequiredChannel) {
    if (!getText(channel, elem)) {
      errors.push({
        category: "RSS 2.0",
        message: `Missing required channel element: <${elem}>`,
        severity: "error",
      });
    }
  }

  // === APPLE PODCASTS ===

  // itunes:image (cover art)
  if (!getElement(channel, "itunes:image")) {
    errors.push({
      category: "Apple Podcasts",
      message: "Missing <itunes:image> (cover art required)",
      severity: "error",
    });
  }

  // itunes:category
  if (!getElement(channel, "itunes:category")) {
    errors.push({
      category: "Apple Podcasts",
      message: "Missing <itunes:category>",
      severity: "error",
    });
  }

  // itunes:author
  if (!getText(channel, "itunes:author")) {
    errors.push({
      category: "Apple Podcasts",
      message: "Missing <itunes:author>",
      severity: "error",
    });
  }

  // itunes:summary or description (for search)
  if (!getText(channel, "itunes:summary") && !getText(channel, "description")) {
    errors.push({
      category: "Apple Podcasts",
      message: "Missing podcast summary (<itunes:summary> or <description>)",
      severity: "error",
    });
  }

  // itunes:explicit
  if (!getText(channel, "itunes:explicit")) {
    errors.push({
      category: "Apple Podcasts",
      message: "Missing <itunes:explicit>",
      severity: "warning",
    });
  }

  // itunes:owner with email
  const owner = getElement(channel, "itunes:owner");
  if (!owner || !getText(owner, "itunes:email")) {
    errors.push({
      category: "Apple Podcasts",
      message: "Missing <itunes:owner> with <itunes:email>",
      severity: "warning",
    });
  }

  // === PSP-1 (Podcast Standards Project) ===

  // Check namespaces in raw content
  if (!content.includes("xmlns:itunes")) {
    errors.push({
      category: "PSP-1",
      message: "Missing iTunes namespace declaration",
      severity: "error",
    });
  }

  if (!content.includes("xmlns:content")) {
    errors.push({
      category: "PSP-1",
      message: "Missing content namespace declaration",
      severity: "warning",
    });
  }

  if (!content.includes("xmlns:podcast")) {
    errors.push({
      category: "PSP-1",
      message: "Missing podcast namespace declaration (podcast:guid, etc.)",
      severity: "warning",
    });
  }

  // podcast:guid (recommended for PSP-1)
  if (!getText(channel, "podcast:guid")) {
    errors.push({
      category: "PSP-1",
      message: "Missing <podcast:guid> (recommended for podcast identification)",
      severity: "warning",
    });
  }

  // language
  if (!getText(channel, "language")) {
    errors.push({
      category: "PSP-1",
      message: "Missing <language>",
      severity: "warning",
    });
  }

  // === ITEMS ===

  let items = channel.item;
  if (!items) {
    errors.push({
      category: "RSS 2.0",
      message: "Feed has no items",
      severity: "error",
    });
    printResults(errors);
    Deno.exit(1);
  }

  if (!Array.isArray(items)) {
    items = [items];
  }

  console.log(`Validating ${items.length} episodes...\n`);

  let itemIndex = 0;
  for (const item of items) {
    itemIndex++;
    const title = getText(item, "title") || `Item ${itemIndex}`;

    // RSS 2.0 required item elements
    if (!getText(item, "title")) {
      errors.push({
        category: "RSS 2.0",
        message: `Episode ${itemIndex}: Missing <title>`,
        severity: "error",
      });
    }

    if (!getText(item, "guid")) {
      errors.push({
        category: "RSS 2.0",
        message: `${title}: Missing <guid>`,
        severity: "error",
      });
    }

    if (!getText(item, "pubDate")) {
      errors.push({
        category: "RSS 2.0",
        message: `${title}: Missing <pubDate>`,
        severity: "error",
      });
    }

    // Enclosure (required for podcasts)
    const enclosure = getElement(item, "enclosure");
    if (!enclosure) {
      errors.push({
        category: "Apple Podcasts",
        message: `${title}: Missing <enclosure>`,
        severity: "error",
      });
    } else {
      const url = enclosure["@url"];
      const length = enclosure["@length"];
      const type = enclosure["@type"];

      if (!url) {
        errors.push({
          category: "Apple Podcasts",
          message: `${title}: Enclosure missing url attribute`,
          severity: "error",
        });
      } else {
        // Decode HTML entities for URL checking
        const decodedUrl = url.replace(/&#x2F;/g, "/").replace(/&amp;/g, "&");

        // Check URL has file extension
        if (!decodedUrl.match(/\.(mp3|m4a|wav|ogg|aac)$/i)) {
          errors.push({
            category: "Apple Podcasts",
            message: `${title}: Enclosure URL should have audio file extension`,
            severity: "warning",
          });
        }
        // Check https
        if (!decodedUrl.startsWith("https://")) {
          errors.push({
            category: "Apple Podcasts",
            message: `${title}: Enclosure URL should use https`,
            severity: "warning",
          });
        }
      }

      if (!length || length === "0") {
        errors.push({
          category: "Apple Podcasts",
          message: `${title}: Enclosure missing or zero length`,
          severity: "warning",
        });
      }

      if (type !== "audio/mpeg" && type !== "audio/x-m4a") {
        errors.push({
          category: "Apple Podcasts",
          message: `${title}: Enclosure type "${type}" may not be supported`,
          severity: "warning",
        });
      }
    }

    // iTunes item elements
    if (!getText(item, "itunes:duration")) {
      errors.push({
        category: "Apple Podcasts",
        message: `${title}: Missing <itunes:duration>`,
        severity: "warning",
      });
    }

    // Description or itunes:summary (for search)
    if (!getText(item, "description") && !getText(item, "itunes:summary")) {
      errors.push({
        category: "Apple Podcasts",
        message: `${title}: Missing episode description`,
        severity: "warning",
      });
    }

    // content:encoded (full shownotes)
    if (!getText(item, "content:encoded")) {
      errors.push({
        category: "PSP-1",
        message: `${title}: Missing <content:encoded> (full shownotes)`,
        severity: "warning",
      });
    }
  }

  printResults(errors);

  const hasErrors = errors.some((e) => e.severity === "error");
  if (hasErrors) {
    Deno.exit(1);
  }
}

function printResults(errors: ValidationError[]) {
  if (errors.length === 0) {
    console.log("Feed validation passed!");
    return;
  }

  const errorCount = errors.filter((e) => e.severity === "error").length;
  const warnCount = errors.filter((e) => e.severity === "warning").length;

  // Group by category
  const byCategory = new Map<string, ValidationError[]>();
  for (const error of errors) {
    const existing = byCategory.get(error.category) || [];
    existing.push(error);
    byCategory.set(error.category, existing);
  }

  console.log("Feed validation results:\n");

  for (const [category, categoryErrors] of byCategory) {
    console.log(`[${category}]`);
    for (const error of categoryErrors) {
      const prefix = error.severity === "error" ? "ERROR" : "WARN ";
      console.log(`  ${prefix}: ${error.message}`);
    }
    console.log();
  }

  console.log(`---`);
  console.log(`Total: ${errorCount} errors, ${warnCount} warnings`);
}

main();

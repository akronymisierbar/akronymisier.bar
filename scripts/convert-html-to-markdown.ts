#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Converts HTML shownotes in episode markdown files to proper markdown.
 * Preserves TOML frontmatter intact.
 */

import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts";

const EPISODES_DIR = new URL("../content/episodes", import.meta.url).pathname;

function htmlToMarkdown(html: string): string {
  let md = html;

  // Normalize whitespace first
  md = md.replace(/\s+/g, " ").trim();

  // Convert headings
  md = md.replace(/<h3[^>]*>\s*/gi, "\n### ");
  md = md.replace(/<\/h3>/gi, "\n");
  md = md.replace(/<h2[^>]*>\s*/gi, "\n## ");
  md = md.replace(/<\/h2>/gi, "\n");
  md = md.replace(/<h4[^>]*>\s*/gi, "\n#### ");
  md = md.replace(/<\/h4>/gi, "\n");

  // Handle paragraphs
  md = md.replace(/<p[^>]*>\s*/gi, "\n");
  md = md.replace(/<\/p>/gi, "\n");

  // Handle blockquotes
  md = md.replace(/<blockquote[^>]*>\s*/gi, "\n> ");
  md = md.replace(/<\/blockquote>/gi, "\n");

  // Handle code blocks
  md = md.replace(/<pre[^>]*><code[^>]*>/gi, "\n```\n");
  md = md.replace(/<\/code><\/pre>/gi, "\n```\n");
  md = md.replace(/<code[^>]*>/gi, "`");
  md = md.replace(/<\/code>/gi, "`");

  // Handle emphasis
  md = md.replace(/<strong[^>]*>/gi, "**");
  md = md.replace(/<\/strong>/gi, "**");
  md = md.replace(/<b>/gi, "**");
  md = md.replace(/<\/b>/gi, "**");
  md = md.replace(/<em[^>]*>/gi, "*");
  md = md.replace(/<\/em>/gi, "*");
  md = md.replace(/<i>/gi, "*");
  md = md.replace(/<\/i>/gi, "*");

  // Convert links: <a href="url">text</a> -> [text](url)
  md = md.replace(/<a\s+href\s*=\s*"?([^">\s]+)"?\s*[^>]*>([^<]*)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<a\s+href\s*=\s*'([^']+)'\s*[^>]*>([^<]*)<\/a>/gi, "[$2]($1)");

  // Handle nested lists by tracking depth
  // First, mark nested list starts/ends
  let depth = 0;
  let result = "";
  let i = 0;

  while (i < md.length) {
    if (md.slice(i).match(/^<ul[^>]*>/i)) {
      depth++;
      const match = md.slice(i).match(/^<ul[^>]*>/i)!;
      i += match[0].length;
      if (depth === 1) {
        result += "\n";
      }
    } else if (md.slice(i).match(/^<\/ul>/i)) {
      depth--;
      i += 5; // length of "</ul>"
    } else if (md.slice(i).match(/^<ol[^>]*>/i)) {
      depth++;
      const match = md.slice(i).match(/^<ol[^>]*>/i)!;
      i += match[0].length;
      if (depth === 1) {
        result += "\n";
      }
    } else if (md.slice(i).match(/^<\/ol>/i)) {
      depth--;
      i += 5; // length of "</ol>"
    } else if (md.slice(i).match(/^<li[^>]*>/i)) {
      const match = md.slice(i).match(/^<li[^>]*>/i)!;
      i += match[0].length;
      const indent = "  ".repeat(Math.max(0, depth - 1));
      result += `\n${indent}- `;
    } else if (md.slice(i).match(/^<\/li>/i)) {
      i += 5; // length of "</li>"
    } else {
      result += md[i];
      i++;
    }
  }
  md = result;

  // Handle line breaks
  md = md.replace(/<br\s*\/?>/gi, "\n");

  // Remove any remaining HTML tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, " ");

  // Clean up extra whitespace
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.replace(/^\s+/gm, (match: string) => {
    // Preserve indentation for nested list items
    const spaces = match.match(/^(  )*/)?.[0] || "";
    return spaces;
  });
  md = md.trim();

  return md;
}

function isHtmlContent(content: string): boolean {
  // Check if content contains HTML tags
  return /<(h[1-6]|ul|ol|li|a|p|div|span|blockquote|pre|code)[^>]*>/i.test(content);
}

async function convertEpisode(filePath: string): Promise<boolean> {
  const content = await Deno.readTextFile(filePath);

  // Split frontmatter and body
  const frontmatterMatch = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    console.log(`  Skipping ${filePath}: No frontmatter found`);
    return false;
  }

  const [, frontmatter, body] = frontmatterMatch;

  // Check if body contains HTML
  if (!isHtmlContent(body)) {
    console.log(`  Skipping ${filePath}: Already markdown`);
    return false;
  }

  // Convert HTML to markdown
  const markdown = htmlToMarkdown(body);

  // Write back
  const newContent = `+++\n${frontmatter}\n+++\n\n${markdown}\n`;
  await Deno.writeTextFile(filePath, newContent);

  console.log(`  Converted ${filePath}`);
  return true;
}

async function main() {
  console.log("Converting HTML shownotes to Markdown...\n");

  let converted = 0;
  let skipped = 0;

  for await (const entry of walk(EPISODES_DIR, { exts: [".md"], maxDepth: 1 })) {
    if (entry.name === "_index.md") continue;

    const result = await convertEpisode(entry.path);
    if (result) {
      converted++;
    } else {
      skipped++;
    }
  }

  console.log(`\nDone! Converted: ${converted}, Skipped: ${skipped}`);
}

main();

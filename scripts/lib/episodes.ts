import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";

export const EPISODES_DIR = join(import.meta.dirname, "../../content/episodes");
export const MEDIA_BASE_URL = "https://kkw.lol/k/akb";

export interface EpisodeFrontmatter {
  title?: string;
  date?: string | Date;
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
  };
}

/** Absolute paths of all episode files, sorted by episode number. */
export async function listEpisodeFiles(): Promise<string[]> {
  const names = await readdir(EPISODES_DIR);
  return names
    .filter((name) => /^\d+\.md$/.test(name))
    .sort()
    .map((name) => join(EPISODES_DIR, name));
}

/** Splits a Zola page into its TOML frontmatter and markdown body. */
export function parseEpisode(content: string): { frontmatter: EpisodeFrontmatter | null; body: string } {
  const match = content.match(/^\+\+\+\n([\s\S]*?)\n\+\+\+\n?([\s\S]*)$/);
  if (!match) return { frontmatter: null, body: content };
  try {
    return { frontmatter: parse(match[1]) as EpisodeFrontmatter, body: match[2] };
  } catch {
    return { frontmatter: null, body: content };
  }
}

export async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getContentLength(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    const length = res.headers.get("Content-Length");
    return length ? parseInt(length, 10) : 0;
  } catch {
    return 0;
  }
}

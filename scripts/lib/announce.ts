import type { EpisodeFrontmatter } from "./episodes.ts";

const SITE_URL = "https://akronymisier.bar";

export interface Episode {
  number: string;
  frontmatter: EpisodeFrontmatter;
}

/**
 * Only the newest episode is a candidate: many old episodes never got a
 * social_interact link and must not be announced retroactively.
 */
export function findEpisodeToAnnounce(episodes: Episode[]): Episode | null {
  const newest = episodes
    .filter((e) => !e.frontmatter.draft)
    .reduce<Episode | null>((max, e) => (max && max.number > e.number ? max : e), null);
  return newest && !newest.frontmatter.extra?.social_interact ? newest : null;
}

export function episodeUrl(episode: Episode): string {
  return `${SITE_URL}/episodes/${episode.number}/`;
}

export function composeStatus(episode: Episode): string {
  return `${episode.frontmatter.extra?.description ?? ""}\n\n${episodeUrl(episode)}`;
}

/** Edits the line in place instead of re-serializing, so the rest of the file keeps its formatting. */
export function setSocialInteract(content: string, url: string): string {
  const end = content.indexOf("\n+++", 3) + 1;
  if (end === 0 || !content.startsWith("+++\n")) throw new Error("No TOML frontmatter found");
  const frontmatter = content.slice(0, end);
  if (!/^\[extra\]$/m.test(frontmatter)) throw new Error("Frontmatter has no [extra] table");

  // JSON string syntax is a valid TOML basic string.
  const line = `social_interact = ${JSON.stringify(url)}`;
  const existing = /^social_interact\s*=.*$/m;
  // [extra] is always the last table, so appending puts the key inside it.
  const updated = existing.test(frontmatter) ? frontmatter.replace(existing, () => line) : `${frontmatter}${line}\n`;
  return updated + content.slice(end);
}

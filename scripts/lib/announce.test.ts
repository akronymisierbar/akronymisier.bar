import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "smol-toml";
import {
  composeStatus,
  type Episode,
  findEpisodeToAnnounce,
  setSocialInteract,
} from "./announce.ts";

const ep = (
  number: string,
  { draft, link }: { draft?: boolean; link?: string } = {},
): Episode => ({
  number,
  frontmatter: {
    title: `${number} - Titel`,
    ...(draft === undefined ? {} : { draft }),
    extra: { description: "Beschreibung", ...(link ? { social_interact: link } : {}) },
  },
});

const LINK = "https://chaos.social/@akronymisierbar/1";

test("findEpisodeToAnnounce picks the highest number regardless of input order", () => {
  const picked = findEpisodeToAnnounce([ep("061", { link: LINK }), ep("063"), ep("062")]);
  assert.equal(picked?.number, "063");
});

test("findEpisodeToAnnounce skips drafts", () => {
  const picked = findEpisodeToAnnounce([ep("062"), ep("064", { draft: true }), ep("063", { draft: false })]);
  assert.equal(picked?.number, "063");
});

test("findEpisodeToAnnounce returns null when the newest episode already has a link", () => {
  assert.equal(findEpisodeToAnnounce([ep("061"), ep("062", { link: LINK }), ep("060")]), null);
});

test("composeStatus is the description, a blank line, then the episode URL", () => {
  const episode: Episode = {
    number: "007",
    frontmatter: { extra: { description: "Live und in Farbe vom 39c3." } },
  };
  assert.equal(composeStatus(episode), "Live und in Farbe vom 39c3.\n\nhttps://akronymisier.bar/episodes/007/");
});

// The body links the old post too, so a global search-and-replace would show up.
const OLD = "https://chaos.social/@akronymisierbar/115844624742050308";
const body = `
### Links

- [meshtastic](https://meshtastic.org/)
- [Toot](${OLD})
`;
const head = `+++
title = "061 - Kraftradeln"
date = 2026-01-04
template = "episode.html"
aliases = ["/061"]

[extra]
guid = "93dc46b5-07d2-4a2f-ac4a-3db5b59fe396"
duration = "01:01:19"
audio_length = 58972225
description = """Live und in Farbe mit mcnesium vom 39c3."""
`;
const withLink = `${head}social_interact = "${OLD}"\ncover_image = "cover.png"\n+++\n${body}`;
const withoutLink = `${head}cover_image = "cover.png"\n+++\n${body}`;

// `$&` and `$1` are special in String.prototype.replace replacement strings.
const NEW = "https://example.social/@a/42?x=$&y=$1";

const frontmatter = (content: string) => parse(content.split("+++\n")[1]!);

test("setSocialInteract replaces an existing value and changes nothing else", () => {
  const expected = withLink.replace(`social_interact = "${OLD}"`, () => `social_interact = "${NEW}"`);
  assert.equal(setSocialInteract(withLink, NEW), expected);
});

test("setSocialInteract adds the key under [extra] and leaves the rest of the file intact", () => {
  const result = setSocialInteract(withoutLink, NEW);

  const expected = frontmatter(withoutLink) as { extra: Record<string, unknown> };
  expected.extra.social_interact = NEW;
  assert.deepEqual(frontmatter(result), expected);

  assert.equal(result.replace(`social_interact = "${NEW}"\n`, () => ""), withoutLink);
});

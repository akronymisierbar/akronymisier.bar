#! /usr/bin/env deno run --allow-net

import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const res = await fetch(
  "https://validator.w3.org/feed/check.cgi?url=https://akronymisier.bar/feed.rss"
);
const html = await res.text();

const doc = new DOMParser().parseFromString(html, "text/html")!;

const columnRegex = /column (\d+):/;

// deno-lint-ignore no-explicit-any
function printIssue(issue: any, severity: string) {
  const line = issue
    .querySelector("a:nth-child(1)")
    .textContent.replace("line ", "");
  const message = issue.querySelector("span.message").textContent;
  // const feedItem = issue
  //   .querySelector("blockquote > pre")
  //   .textContent.replace("^", "")
  //   .trim();
  const p = issue.querySelector("p:nth-child(1)").textContent;
  const column = p.match(columnRegex)[1];

  console.log(`::${severity} file=public/feed.rss,line=${line},col=${column}::${message}`);
}

const issues = doc
  .querySelector("#main > ul:nth-child(4)")!
  .querySelectorAll("li");
if (issues.length !== 0) {
  // console.log(`Found ${issues.length} feed validation issue(s):`);
  issues.forEach((i) => printIssue(i, "error"));
  // console.log("");
}

const compats = doc
  .querySelector("#main > ul:nth-child(6)")!
  .querySelectorAll("li");
if (compats.length !== 0) {
  // console.log(`Found ${compats.length} compatibility issue(s):`);
  compats.forEach((i) => printIssue(i, "warning"));
  // console.log("");
}

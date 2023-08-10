#! /usr/bin/env deno run --allow-net

import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

if (Deno.args.length !== 1) {
  console.log("Usage: ./validate-feed-w3c.ts <feed-url>");
  Deno.exit(1);
}

const res = await fetch(Deno.args[0]);
const html = await res.text();

const doc = new DOMParser().parseFromString(html, "text/html")!;

const columnRegex = /column (\d+):/;

// deno-lint-ignore no-explicit-any
function printIssue(issue: any, severity: string) {
  let line = "0";
  let column = "0";
  if (issue.querySelector("a:nth-child(1)")) {
    line = issue
      .querySelector("a:nth-child(1)")
      .textContent.replace("line ", "");
    const p = issue.querySelector("p:nth-child(1)").textContent;
    column = p.match(columnRegex)[1];
  }
  const message = issue.querySelector("span.message").textContent;

  // const feedItem = issue
  //   .querySelector("blockquote > pre")
  //   .textContent.replace("^", "")
  //   .trim();

  console.log(`::${severity} file=public/feed.rss,line=${line},col=${column}::${message}`);
}

const issues = doc
  .querySelector("#main > ul:nth-child(4)")!
  .querySelectorAll("li");
if (issues.length !== 0) {
  issues.forEach((i) => printIssue(i, "error"));
}

const compats = doc
  .querySelector("#main > ul:nth-child(6)")!
  .querySelectorAll("li");
if (compats.length !== 0) {
  compats.forEach((i) => printIssue(i, "warning"));
}

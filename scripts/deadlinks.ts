#! /usr/bin/env deno run --allow-read --allow-net

import { parse } from "https://deno.land/x/xml@2.1.1/mod.ts";
import { Item, num } from "./types.ts";

function getURLs(item: Item): string[] {
  const urlRegExp = /(\bhttps?:\/\/\S+)"/gi;
  let match;
  const urls = [];

  while ((match = urlRegExp.exec(item["content:encoded"])) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

function timeout(ms: number, promise: Promise<any>) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request timed out'));
    }, ms);
  
    promise.then(value => {
      clearTimeout(timer);
      resolve(value);
    }).catch(reason => {
      clearTimeout(timer);
      reject(reason);
    })
  });
}

if (Deno.args.length < 1) {
  console.error("Usage: ./deadlinks.ts /path/to/feed.rss");
  Deno.exit(1);
}

const data = await Deno.readTextFile(Deno.args[0]);
const feed = parse(data);
let items;

if (Deno.args[1]) {
  items = feed?.rss?.channel?.item.filter(i => num(i) === Deno.args[1]);
} else {
  items = feed?.rss?.channel?.item;
}

for (const item of items) {
  console.log(`${num(item)}:`)

  const fetchPromises = getURLs(item).map(url => {
    return timeout(5000, fetch(url, { method: "HEAD", redirect: "manual" }))
    // return fetch(url, { method: "HEAD", redirect: "manual" })
      .then(res => {
        if (!res.ok) {
          if (res.status.toString().startsWith("3")) {
            // console.error(` - ${res.status} ${url} -> ${res.headers.get("location")}`);
          } else {
            console.error(` - ${res.status} on ${url}`);
          }
        }
      })
      .catch(error => console.error(` - ${url} ${error}`));
  });

  await Promise.all(fetchPromises);

  console.log("");
}

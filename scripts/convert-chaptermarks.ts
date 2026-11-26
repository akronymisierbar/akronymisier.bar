#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

const convertToSeconds = (time: string) => {
  const [hours, minutes, seconds] = time.split(':').map(parseFloat);
  return hours * 3600 + minutes * 60 + seconds;
};

const generateJson = async (inputFile: string, outputFile: string) => {
  const data = await readFile(inputFile, "utf8");
  const lines = data.split('\n').filter(line => line.trim() !== '');
  
  const chapters = lines.map(line => {
    const [startTime, ...titleParts] = line.split(' ');
    const title = titleParts.join(' ');
    return {
      startTime: convertToSeconds(startTime),
      title,
    };
  });

  const result = {
    version: "1.2.0",
    chapters,
  };

  await writeFile(outputFile, JSON.stringify(result, null, 2));
};

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log("Usage: ./convert-chaptermarks.ts <episode>.chapters.{txt,json}");
  process.exit(1);
}

await generateJson(args[0], args[1]);

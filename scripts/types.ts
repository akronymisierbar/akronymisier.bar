export interface Item {
  guid: Guid;
  title: string;
  description: string;
  pubDate: string;
  author: string;
  link: string;
  "content:encoded": string;
  enclosure: Enclosure;
  "itunes:title": string;
  "itunes:author": string;
  "itunes:image"?: iTunesImage;
  "itunes:duration": string;
  "itunes:summary": string;
  "itunes:subtitle": string;
  "itunes:explicit": boolean,
  "itunes:episodeType": string;
  "itunes:episode": number;
  "podcast:chapters"?: Chapters;
  "podcast:socialInteract"?: SocialInteract;
}

interface Guid {
  "@isPermaLink": boolean;
  "#text": string;
}

interface Enclosure {
  "@length": string;
  "@type": string;
  "@url": string;
}

interface iTunesImage {
  "@href": string;
}

interface Chapters {
  "@url": string;
  "@type": string;
}

interface SocialInteract {
  "@uri": string;
  "@protocol": string;
  "@accountId": string;
  "@accountUrl": string;
}

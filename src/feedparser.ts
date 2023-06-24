import dateFormat from "dateformat";

export async function getFeedItems(): Promise<EpisodeDetails[]> {
  const res = await fetch('/feed.rss');
  const str = await res.text();
  const data = new window.DOMParser().parseFromString(str, 'text/xml');
  const feedItems = data.getElementsByTagName('item');
  return Array.from(feedItems).map((item, index) => {
    const pubDate = item.getElementsByTagName('pubDate')[0].textContent ?? '';
    return {
      id: item.getElementsByTagName('itunes:episode')[0].textContent?.padStart(3, '0') ?? '',
      title: item.getElementsByTagName('title')[0].textContent ?? '',
      date: dateFormat(pubDate, 'mmm d, yyyy'),
      cover: item.getElementsByTagName('itunes:image')[0]?.getAttribute('href') ?? '',
      duration: item.getElementsByTagName('itunes:duration')[0].textContent ?? '',
      audio: item.getElementsByTagName('enclosure')[0].getAttribute('url') ?? '',
      summary: item.getElementsByTagName('itunes:summary')[0].textContent ?? '',
      description: item.getElementsByTagName('description')[0].textContent ?? ''
    };
  });
};

export interface EpisodeDetails {
  id: string;
  title: string;
  date: string;
  cover: string | null;
  duration: string;
  audio: string;
  summary: string;
  description: string;
};

export async function getEpisodeDetails(episode: string): Promise<EpisodeDetails> {
  const feedItems = Array.from(await getFeedItems());
  const item = feedItems.find(i => i.id == episode);
  if (!item) {
    throw new Error(`cannot find episode '${episode}'`);
  }
  return item;
};

export async function getFeedItems() {
  const res = await fetch('/feed.rss');
  const str = await res.text();
  const data = new window.DOMParser().parseFromString(str, 'text/xml');
  return data.getElementsByTagName('item');
};

export interface EpisodeDetails {
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
  const item = feedItems.find(i => 
    i.getElementsByTagName('itunes:episode')[0].textContent === parseInt(episode, 10).toString()
  );
  if (!item) {
    throw new Error('invalid episode number');
  }
  return {
    title: item.getElementsByTagName('title')[0].textContent ?? '',
    date: item.getElementsByTagName('pubDate')[0].textContent ?? '',
    cover: item.getElementsByTagName('itunes:image')[0]?.getAttribute('href') ?? '',
    duration: item.getElementsByTagName('itunes:duration')[0].textContent ?? '',
    audio: item.getElementsByTagName('enclosure')[0].getAttribute('url') ?? '',
    summary: item.getElementsByTagName('itunes:summary')[0].textContent ?? '',
    description: item.getElementsByTagName('description')[0].textContent ?? ''
  };
};

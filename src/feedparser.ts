import dateFormat from "dateformat";

export interface Episode {
  id: string;
  title: string;
  date: string;
  cover?: string;
  duration: string;
  audio: string;
  summary: string;
  description: string;
  content: string;
  chapters?: string;
  socialInteract?: string;
}

export interface Feed {
  pubDate: string;
  episodes: Episode[]
}

export const emptyFeed: Feed = {
  pubDate: "",
  episodes: []
}

export async function getFeed(): Promise<Feed> {
  const res = await fetch("/feed.rss");
  const str = await res.text();
  const data = new window.DOMParser().parseFromString(str, 'text/xml');
  return {
    pubDate: dateFormat(data.getElementsByTagName("pubDate")[0].textContent ?? "", "dd.mm.yyyy HH:MM"),
    episodes: Array.from(data.getElementsByTagName('item')).map((item) => {
      const pubDate = item.getElementsByTagName('pubDate')[0].textContent ?? '';

      return {
        id: item.getElementsByTagName('itunes:episode')[0].textContent?.padStart(3, '0') ?? '',
        title: item.getElementsByTagName('title')[0].textContent ?? '',
        date: dateFormat(pubDate, 'mmm d, yyyy'),
        cover: item.getElementsByTagName('itunes:image')[0]?.getAttribute('href') ?? '',
        duration: item.getElementsByTagName('itunes:duration')[0].textContent ?? '',
        audio: item.getElementsByTagName('enclosure')[0].getAttribute('url') ?? '',
        // TODO: Remove summary and use description instead of it after migrating feed contents.
        summary: item.getElementsByTagName('itunes:summary')[0].textContent ?? '',
        description: item.getElementsByTagName('description')[0].textContent ?? '',
        content: item.getElementsByTagName('content:encoded')[0].textContent ?? '',
        chapters: item.getElementsByTagName('podcast:chapters')[0]?.getAttribute('url') ?? '',
        socialInteract: item.getElementsByTagName('podcast:socialInteract')[0]?.getAttribute('uri') ?? ''
      };
    })
  };
}

export async function getEpisodeDetails(episode: string): Promise<Episode> {
  const feed = await getFeed();
  const item = feed.episodes.find(i => i.id === episode);
  if (!item) {
    throw new Error(`cannot find episode '${episode}'`);
  }
  return item;
}

import { useLoaderData } from "react-router-dom";
import { getEpisodeDetails, EpisodeDetails } from "./feedparser";
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';
import Footer from "./footer";
import { useEffect } from "react";
import unshortifyEmoji from "./emoji";

interface LoaderData {
  episode: EpisodeDetails;
}

export async function episodeLoader({ params }: {params: any}) {
  const episode = await getEpisodeDetails(params.episode);
  return { episode };
}

export default function EpisodeDetail() {
  const { episode } = useLoaderData() as LoaderData;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <h1>{episode.title}</h1>
      <p className='details'>
        <span className="date">{episode.date}</span>
        {' '} · {' '}
        <span className="duration">{episode.duration}</span>
      </p>
      { episode.cover ? <img className="episode-cover" src={episode.cover} alt="coverart" /> : <></> }
      <p className="summary">{unshortifyEmoji(episode.summary)}</p>
      <AudioPlayer
        src={episode.audio}
        customAdditionalControls={[]}
      />
      <p className="description" dangerouslySetInnerHTML={{ __html: unshortifyEmoji(episode.content)}} />
      <Footer />
    </>
  );
}

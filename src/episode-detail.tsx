import { useLoaderData } from "react-router-dom";
import { getEpisodeDetails, EpisodeDetails } from "./feedparser";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import Footer from "./footer";
import { useEffect } from "react";
import unshortifyEmoji from "./emoji";
import { Link } from "react-router-dom";
import { ReactComponent as BackIcon } from "./back-icon.svg";

interface LoaderData {
  episode: EpisodeDetails;
}

export async function episodeLoader({ params }: { params: any }) {
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
      <div className="title-container">
        <div className="back-button">
          <Link to="/">
            <BackIcon style={{ width: "100px", height: "100px" }} />
          </Link>
        </div>
        <h1>{episode.title}</h1>
      </div>
      <p className="details">
        <span className="date">{episode.date}</span> ·{" "}
        <span className="duration">{episode.duration}</span>
      </p>
      <img
        className="episode-cover"
        src={episode.cover ? episode.cover : "/logo512.png"}
        alt="coverart"
      />
      <AudioPlayer src={episode.audio} customAdditionalControls={[]} />
      {episode.summary ? (
        <p className="summary">{unshortifyEmoji(episode.summary)}</p>
      ) : (
        <></>
      )}
      <h2>Shownotes</h2>
      <p
        className="description"
        dangerouslySetInnerHTML={{ __html: unshortifyEmoji(episode.content) }}
      />
      <Footer />
    </>
  );
}

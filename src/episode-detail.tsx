import { useLoaderData } from "react-router-dom";
import { getEpisodeDetails, EpisodeDetails } from "./feedparser";
import AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import { Footer } from "./footer";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ReactComponent as BackIcon } from "./back-icon.svg";
import Giscus from "@giscus/react";

interface LoaderData {
  episode: EpisodeDetails;
}

export async function episodeLoader({ params }: { params: any }) {
  const episode = await getEpisodeDetails(params.episode);
  return { episode };
}

export default function EpisodeDetail() {
  const { episode } = useLoaderData() as LoaderData;
  const [chaptermarks, setChaptermarks] = useState(undefined as string | undefined);

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchChaptermarks = async () => {
      const res = await fetch(`https://media.akronymisier.bar/file/akronymisierbar/${episode.id}.chapters.txt`);
      if (res.ok) {
        setChaptermarks(await res.text());
      } else {
        setChaptermarks(undefined);
      }
    };
    fetchChaptermarks();
  }, []);

  return (
    <>
      <div className="episode-title-container">
        <div className="back-button">
          <Link to="/">
            <BackIcon style={{ width: "100px", height: "100px" }} />
          </Link>
        </div>
        <h1>{episode.title}</h1>
      </div>
      <p className="episode-details">
        <span className="date">{episode.date}</span> ·{" "}
        <span className="duration">{episode.duration}</span>
      </p>
      <img
        className="episode-cover"
        src={episode.cover ? episode.cover : "/logo512.png"}
        alt="coverart"
      />
      <AudioPlayer
        src={episode.audio}
        customAdditionalControls={[]}
        footer={
          chaptermarks !== undefined ? (
            <details>
              <summary>Chaptermarks</summary>
              <pre>{chaptermarks}</pre>
            </details>
          ) : (
            <></>
          )
        }
      />

      {episode.summary ? (
        <p className="summary">{episode.summary}</p>
      ) : (
        <></>
      )}

      <h2>Shownotes</h2>
      <p
        className="episode-content"
        dangerouslySetInnerHTML={{ __html: episode.content }}
      />

      <Giscus
        repo="akronymisierbar/akronymisier.bar"
        repoId="R_kgDOJzcCqA"
        category="Announcements"
        categoryId="DIC_kwDOJzcCqM4CXdbE"
        mapping="pathname"
        strict="0"
        reactionsEnabled="1"
        emitMetadata="0"
        inputPosition="bottom"
        theme="preferred_color_scheme"
        lang="en"
      />
      <Footer />
    </>
  );
}

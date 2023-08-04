import { useLoaderData } from "react-router-dom";
import { Episode } from "../feedparser";
import AudioPlayer from "react-h5-audio-player";
import { Footer } from "../components/footer";
import { useEffect, useState, createRef, RefObject } from "react";
import { Link } from "react-router-dom";
import { ReactComponent as BackIcon } from "../icons/back-icon.svg";

import Giscus from "@giscus/react";
import H5AudioPlayer from "react-h5-audio-player";

interface ChapterMarks {
  chapters: Chapter[];
}

interface Chapter {
  startTime: number;
  title: string;
}

function startTimeToTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  seconds = Math.floor(seconds % 60);

  const formattedHours = hours.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");
  const formattedSeconds = seconds.toString().padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

interface LoaderData {
  episode: Episode;
}

export default function EpisodeDetail() {
  const { episode } = useLoaderData() as LoaderData;
  const [chaptermarks, setChaptermarks] = useState(
    undefined as undefined | ChapterMarks
  );

  const player = createRef() as RefObject<H5AudioPlayer>;

  useEffect(() => {
    window.scrollTo(0, 0);

    const fetchChaptermarks = async () => {
      if (!episode.chapters) {
        return;
      }
      try {
        const res = await fetch(episode.chapters);
        if (res.ok) {
          setChaptermarks(await res.json());
        } else {
          setChaptermarks(undefined);
        }
      } catch (error) {}
    };
    fetchChaptermarks();
  }, [episode]);

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
        ref={player}
        footer={
          chaptermarks !== undefined ? (
            <div className="chapter-marks">
              <details>
                <summary>Chaptermarks</summary>
                {chaptermarks.chapters.map((c) => {
                  return (
                    <button
                      className="link-button"
                      onClick={() => {
                        player.current!.audio.current!.currentTime =
                          c.startTime;
                      }}
                    >
                      {startTimeToTimestamp(c.startTime) + " " + c.title}
                    </button>
                  );
                })}
              </details>
            </div>
          ) : (
            <></>
          )
        }
      />

      {episode.summary ? <p className="summary">{episode.summary}</p> : <></>}

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
      <Footer lastUpdated={undefined} />
    </>
  );
}

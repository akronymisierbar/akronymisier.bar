import React, { useEffect, useState } from "react";
import "./main.css";
import "./thebest.css";
import EpisodeItem from "./episode-item";
import { Footer } from "./footer";
import { getFeedItems, EpisodeDetails } from "./feedparser";
import { LinkBar } from "./linkbar";

function Main() {
  const [episodes, setEpisodes] = useState([] as EpisodeDetails[]);

  useEffect(() => {
    const loadFeedItems = async () => {
      const feedItems = await getFeedItems();
      setEpisodes(feedItems);
    };
    loadFeedItems();
  }, []);

  return (
    <div className="main">
      <header>
        <LinkBar />
        <img
          className="logo center"
          src="logo512.png"
          alt="podcast logo showing headphones and the text Akronymisierbar"
        />
      </header>

      <p>
        Podcast von und mit{" "}
        <a href="https://chaos.social/@hoodie" target="_blank" rel="noreferrer">
          @hoodie
        </a>{" "}
        und{" "}
        <a href="https://chaos.social/@kilian" target="_blank" rel="noreferrer">
          @kilian
        </a>
        . Geballtes gefährliches Halbwissen zu allem rund um
        Programmiersprachen, Messengern und anderen (meist technischen) Themen,
        die uns spontan einfallen.
      </p>

      <h2>Folgen</h2>
      {episodes.map((ep, index) => (
        <div key={ep.id}>
          <EpisodeItem
            title={ep.title}
            link={"/" + ep.id}
            date={ep.date}
            duration={ep.duration}
            summary={ep.summary}
          />
          <hr />
        </div>
      ))}
      <Footer />
    </div>
  );
}

export default Main;

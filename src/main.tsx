import React, { useEffect, useState } from "react";
import "./main.css";
import "./thebest.css";
import EpisodeItem from "./episode-item";
import Footer from "./footer";
import { getFeedItems, EpisodeDetails } from "./feedparser";

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
        <ul className="links">
          <li key="rss">
            <a href="https://feed.akronymisier.bar" target="_blank">RSS Feed</a>
          </li>
          <li key="itunes">
            <a href="https://itunes.apple.com/de/podcast/akronymisierbar/id1200334668" target="_blank">
              Apple Podcasts
            </a>
          </li>
          <li key="matrix">
            <a href="https://matrix.to/#/#akronymisierbar:matrix.org" target="_blank">Matrix</a>
          </li>
          <li key="fediverse">
            <a href="https://chaos.social/@akronymisierbar" target="_blank">Fediverse</a>
          </li>
          <li key="liberapay">
            <a href="https://liberapay.com/akronymisierbar/" target="_blank">Liberapay</a>
          </li>
        </ul>

        <img
          className="logo center"
          src="logo512.png"
          alt="podcast logo showing headphones and the text Akronymisierbar"
        />
      </header>

      <p>
        Podcast von und mit <a href="https://chaos.social/@hoodie">@hoodie</a>{" "}
        und <a href="https://chaos.social/@kilian">@kilian</a>. Geballtes
        gefährliches Halbwissen zu allem rund um Programmiersprachen, Messengern
        und anderen (meist technischen) Themen, die uns spontan einfallen.
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

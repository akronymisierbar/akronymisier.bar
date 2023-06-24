import React, { useEffect, useState } from "react";
import "./App.css";
import "./thebest.css";
import EpisodeItem from "./episode-item";
import Footer from "./footer";
import { getFeedItems, EpisodeDetails } from "./feedparser";

function App() {
  const [episodes, setEpisodes] = useState([] as EpisodeDetails[]);

  useEffect(() => {
    const loadFeedItems = async () => {
      const feedItems = await getFeedItems();
      setEpisodes(feedItems);
    };
    loadFeedItems();
  }, []);

  return (
    <div className="App">
      <header>
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
      <h2>Links</h2>
      <ul>
        <li key="rss">
          <a href="https://feed.akronymisier.bar">RSS Feed</a>
        </li>
        <li key="itunes">
          <a href="https://itunes.apple.com/de/podcast/akronymisierbar/id1200334668">
            Apple Podcasts
          </a>
        </li>
        <li key="matrix">
          <a href="https://matrix.to/#/#akronymisierbar:matrix.org">Matrix</a>
        </li>
        <li key="fediverse">
          <a href="https://chaos.social/@akronymisierbar">Fediverse</a>
        </li>
        <li key="liberapay">
          <a href="https://liberapay.com/akronymisierbar/">Liberapay</a>
        </li>
      </ul>
      <h2>Folgen</h2>
      {episodes.map((ep, index) => (
        <>
          <EpisodeItem
            title={ep.title}
            link={"/" + ep.id}
            date={ep.date}
            duration={ep.duration}
            summary={ep.summary}
          />
          <hr />
        </>
      ))}
      <Footer />
    </div>
  );
}

export default App;

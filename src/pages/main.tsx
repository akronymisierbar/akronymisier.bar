import React, { useEffect, useState } from "react";
import "../styles/main.css";
import "../styles/thebest.css";
import EpisodeItem from "../components/episode-item";
import { Footer } from "../components/footer";
import { getFeed, emptyFeed } from "../feedparser";
import { LinkBar } from "../components/linkbar";

function Main() {
  const [feedData, setFeedData] = useState(emptyFeed);

  useEffect(() => {
    const loadFeedItems = async () => {
      const feed = await getFeed();
      setFeedData(feed);
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
      {feedData.episodes.map((ep, index) => (
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
      <Footer lastUpdated={feedData.pubDate}/>
    </div>
  );
}

export default Main;

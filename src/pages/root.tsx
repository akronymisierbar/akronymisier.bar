import { useEffect, useState, ChangeEvent } from "react";
import "react-h5-audio-player/lib/styles.css";
import "../styles/main.css";
import "../styles/thebest.css";
import EpisodeItem from "../components/episode-item";
import { Footer } from "../components/footer";
import { getFeed, emptyFeed } from "../feedparser";
import { LinkBar } from "../components/linkbar";
import { ReactComponent as XIcon } from "../icons/x-circle.svg";

export default function Root() {
  const [feedData, setFeedData] = useState(emptyFeed);
  const [searchQuery, setSearchQuery] = useState("");

  const onSearchQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  function clearSearchQuery() {
    setSearchQuery("");
  }

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
          Hendrik
        </a>{" "}
        und{" "}
        <a href="https://chaos.social/@kilian" target="_blank" rel="noreferrer">
          Kilian
        </a>
        . Geballtes gefährliches Halbwissen zu allem rund um
        Programmiersprachen, Messengern und anderen (meist technischen) Themen,
        die uns spontan einfallen.
      </p>

      <div className="episodes-title-container">
        <h2>Folgen</h2>
        <div className="search-container">
          <input
            value={searchQuery}
            onChange={onSearchQueryChange}
            type="text"
            id="search"
            placeholder="Suche..."
            name="search"
          />
          <div className="clear-search-button" onClick={clearSearchQuery} style={{display: searchQuery ? "": "none"}}>
            <XIcon />
          </div>
        </div>
      </div>
      {feedData.episodes
        .filter((ep) => {
          if (!searchQuery) {
            return true;
          }
          const query = searchQuery.toLowerCase();
          return (
            ep.title.toLowerCase().includes(query) ||
            ep.summary.toLowerCase().includes(query) ||
            ep.description.toLowerCase().includes(query)
          );
        })
        .map((ep) => (
          <div key={ep.id}>
            <EpisodeItem
              title={ep.title}
              link={"/" + ep.id}
              date={ep.date}
              duration={ep.duration}
              summary={ep.summary}
              cover={ep.cover}
            />
            <hr />
          </div>
        ))}
      <Footer lastUpdated={feedData.pubDate} />
    </div>
  );
}

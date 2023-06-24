import React, { useEffect, useState } from 'react';
import { ReactComponent as ApplePodcastsBadge } from './apple-podcasts-badge.svg';
import './App.css';
import './thebest.css';
import EpisodeItem from './EpisodeItem';

function App() {
  const [items, setItems] = useState([] as Element[]);

  useEffect(() => {
    const readFeed = async () => {
      const res = await fetch('/feed.rss');
      const str = await res.text();
      const data = new window.DOMParser().parseFromString(str, 'text/xml');
      const items = data.getElementsByTagName('item');
      setItems(Array.from(items));
    };
    readFeed();
  }, []);

  return (
    <div className="App">
      <header>
        {/* <h1>Akronymisierbar</h1> */}
        <img className='logo center' src="logo512.png" alt="podcast logo showing headphones and the text Akronymisierbar" />
      </header>
      <p>Podcast von und mit <a href="https://chaos.social/@hoodie">@hoodie</a> und <a href="https://chaos.social/@kilian">@kilian</a>. Geballtes gefährliches Halbwissen zu allem rund um Programmiersprachen, Messengern und anderen (meist technischen) Themen, die uns spontan einfallen.</p>
      <h2>Links</h2>
      <ul>
        <li key='rss'><a href="https://feed.akronymisier.bar">RSS Feed</a></li>
        <li key='itunes'><a href="https://itunes.apple.com/de/podcast/akronymisierbar/id1200334668">Apple Podcasts</a></li>
        <li key='matrix'><a href="https://matrix.to/#/#akronymisierbar:matrix.org">Matrix</a></li>
        <li key='fediverse'><a href="https://chaos.social/@akronymisierbar">Fediverse</a></li>
        <li key='liberapay'><a href="https://liberapay.com/akronymisierbar/">Liberapay</a></li>
      </ul>
      <h2>Folgen</h2>
      {items.map((item, index) => (
        <>
        <EpisodeItem 
          title={item.getElementsByTagName('title')[0].textContent ?? ''}
          link={'/' + item.getElementsByTagName('itunes:episode')[0].textContent?.padStart(3, '0')}
          date={item.getElementsByTagName('pubDate')[0].textContent ?? ''}
          duration={item.getElementsByTagName('itunes:duration')[0].textContent ?? ''}
          summary={item.getElementsByTagName('itunes:summary')[0].textContent ?? ''}
        />
        <hr />
        </>
      ))}
      <div className="footer">
        <p>© Copyright 2023 Akronymisierbar</p>
        <a href="#">Legal Notice</a>
      </div>
    </div>
  );
}

export default App;

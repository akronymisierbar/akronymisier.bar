export function LinkBar() {
  return (
    <ul className="links">
      <li key="rss">
        <a
          href="https://akronymisier.bar/feed.rss"
          target="_blank"
          rel="noreferrer"
        >
          RSS Feed
        </a>
      </li>
      <li key="itunes">
        <a
          href="https://itunes.apple.com/de/podcast/akronymisierbar/id1200334668"
          target="_blank"
          rel="noreferrer"
        >
          Apple Podcasts
        </a>
      </li>
      <li key="matrix">
        <a
          href="https://matrix.to/#/#akronymisierbar:matrix.org"
          target="_blank"
          rel="noreferrer"
        >
          Matrix
        </a>
      </li>
      <li key="fediverse">
        <a
          href="https://chaos.social/@akronymisierbar"
          target="_blank"
          rel="noreferrer"
        >
          Fediverse
        </a>
      </li>
      <li key="liberapay">
        <a
          href="https://liberapay.com/akronymisierbar/"
          target="_blank"
          rel="noreferrer"
        >
          Liberapay
        </a>
      </li>
    </ul>
  );
}

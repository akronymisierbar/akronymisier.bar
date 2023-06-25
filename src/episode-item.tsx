import { Link } from "react-router-dom";
import unshortifyEmoji from "./emoji";

interface EpisodeItemProps {
  title: string;
  link: string;
  date: string;
  duration: string;
  summary: string;
}

function EpisodeItem({
  title,
  link,
  date,
  duration,
  summary,
}: EpisodeItemProps) {
  return (
    <article>
      <Link to={link}>
        <h3 className="episode-title">{title}</h3>
      </Link>
      <p className="episode-summary">{unshortifyEmoji(summary)}</p>
      <p className="episode-details">
        <span className="date">{date}</span> ·{" "}
        <span className="duration">{duration}</span>
      </p>
    </article>
  );
}

export default EpisodeItem;

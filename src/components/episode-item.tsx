import { Link } from "react-router-dom";

interface EpisodeItemProps {
  title: string;
  link: string;
  date: string;
  duration: string;
  summary: string;
  cover?: string;
}

function EpisodeItem({
  title,
  link,
  date,
  duration,
  summary,
  cover,
}: EpisodeItemProps) {
  return (
    <article>
      <Link to={link}>
        <img src={cover ? cover : "/logo512.png"} alt="cover der folge" />
      </Link>
      <div className="content">
        <Link to={link}>
          <h3 className="episode-title">{title}</h3>
        </Link>
        <p className="episode-summary">{summary}</p>
        <p className="episode-details">
          <span className="date">{date}</span> ·{" "}
          <span className="duration">{duration}</span>
        </p>
      </div>
    </article>
  );
}

export default EpisodeItem;

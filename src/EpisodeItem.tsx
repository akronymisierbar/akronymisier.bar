import { Link } from "react-router-dom";

interface EpisodeItemProps {
  title: string;
  link: string;
  date: string;
  duration: string;
  summary: string;
}

function EpisodeItem({title, link, date, duration, summary}: EpisodeItemProps) {
  return (
    <article>
      <Link to={link}><h3 className="episode-title">{title}</h3></Link>
      <p className='details'><span className="date">{date}</span> · <span className="duration">{duration}</span></p>
      <p className='summary'>{summary}</p>
    </article>
  );
}

export default EpisodeItem;

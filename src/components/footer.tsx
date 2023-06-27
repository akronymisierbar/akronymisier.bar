import { Link } from "react-router-dom";

export const Footer = ({ lastUpdated }: { lastUpdated: string | undefined }) => (
  <div className="footer">
    {lastUpdated ? <p>Feed zuletzt aktualisiert: {lastUpdated}</p> : <></>}
    <p>© Copyright 2023 Akronymisierbar</p>
    <Link to={`/impressum`}>Impressum</Link>
  </div>
);

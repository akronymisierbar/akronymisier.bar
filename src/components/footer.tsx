import { Link } from "react-router-dom";

export const Footer = () => (
  <div className="footer">
    <p>© Copyright 2023 Akronymisierbar</p>
    <Link to={`/impressum`}>Impressum</Link>
  </div>
);

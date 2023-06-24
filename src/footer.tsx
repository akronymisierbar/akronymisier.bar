import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <div className="footer">
      <p>© Copyright 2023 Akronymisierbar</p>
      <Link to={`/impressum`}>Impressum</Link>
    </div>
  );
}

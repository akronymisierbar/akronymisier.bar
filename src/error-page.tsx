import { useRouteError } from "react-router-dom";

export default function ErrorPage() {
  const error = useRouteError() as any;

  return (
    <div className="error-page">
      <h1>Uppsi!</h1>
      <p>Tschuligom, da ist wohl ein Fehler passiert.</p>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
    </div>
  );
};

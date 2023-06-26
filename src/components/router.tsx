import { createBrowserRouter } from "react-router-dom";
import Main from "../pages/main";
import ErrorPage from "../pages/error-page";
import LegalNotice from "../pages/legal-notice";
import EpisodeDetail, { episodeLoader } from "../pages/episode-detail";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Main />,
    errorElement: <ErrorPage />,
  },
  {
    path: "impressum",
    element: <LegalNotice />,
  },
  {
    path: "/023",
    element: <p style={{ fontSize: "240px", textAlign: "center" }}>👀</p>,
  },
  {
    path: ":episode",
    element: <EpisodeDetail />,
    loader: episodeLoader,
    errorElement: <ErrorPage />,
  },
]);

import { createBrowserRouter } from "react-router-dom";
import Root from "./pages/root";
import ErrorPage from "./pages/error-page";
import LegalNotice from "./pages/legal-notice";
import EpisodeDetail from "./pages/episode-detail";
import { getEpisodeDetails } from "./feedparser";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
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

async function episodeLoader({ params }: { params: any }) {
  const episode = await getEpisodeDetails(params.episode);
  return { episode };
}

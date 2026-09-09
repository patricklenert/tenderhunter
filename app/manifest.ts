import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tenderhunter – KI-Ausschreibungssoftware",
    short_name: "Tenderhunter",
    description:
      "Automatische Suche und Matching öffentlicher Ausschreibungen in Deutschland.",
    start_url: "/",
    display: "standalone",
    background_color: "#f0f4f8",
    theme_color: "#1e3a5f",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}

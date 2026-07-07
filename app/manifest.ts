import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hypnosis Logger",
    short_name: "Hypnosis Log",
    description: "Personal log of one-on-one hypnosis sessions",
    start_url: "/",
    display: "standalone",
    background_color: "#0E1726",
    theme_color: "#0E1726",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

import type { MetadataRoute } from "next";

/** PWA/web-app manifest — name, palette and icon surface for installed contexts. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeNest Kitchen",
    short_name: "HomeNest",
    description: "Premium home & kitchen products for the modern lifestyle",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#c2410c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

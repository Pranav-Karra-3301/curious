import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: "https://curious.pranavkarra.me/sitemap.xml",
    host: "https://curious.pranavkarra.me",
  }
}

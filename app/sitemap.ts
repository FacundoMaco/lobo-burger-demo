import type { MetadataRoute } from "next";

const SITE_URL = "https://loboburger.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/promos`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/puntos`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/terminos`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/libro-reclamaciones`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}

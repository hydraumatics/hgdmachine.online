import { site } from "./site";

/** Serialise JSON-LD safely for embedding in a <script> tag ("<" is escaped so data can never close the tag). */
export const jsonLdString = (data: unknown): string => JSON.stringify(data).replace(/</g, "\\u003c");

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: new URL(it.path, site.url).href })),
  };
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": site.orgId,
    name: site.name,
    url: site.url,
    logo: `${site.url}/brand/logo-tile-512.png`,
    slogan: site.tagline,
    telephone: site.phone,
    email: site.emails.info,
    taxID: site.taxId,
    identifier: { "@type": "PropertyValue", name: "PACRA registration number", value: site.pacra },
    address: { "@type": "PostalAddress", addressLocality: site.locality, addressCountry: site.country },
    areaServed: ["Zambia", "SADC"],
    knowsAbout: ["Mining equipment", "Hydraulic components", "Heavy equipment spare parts", "Industrial lubricants and filters", "Industrial safety equipment"],
    contactPoint: [
      { "@type": "ContactPoint", contactType: "sales", email: site.emails.sales, telephone: site.phone, availableLanguage: "en" },
      { "@type": "ContactPoint", contactType: "customer support", email: site.emails.support, availableLanguage: "en" },
      { "@type": "ContactPoint", contactType: "procurement enquiries", email: site.emails.procurement, availableLanguage: "en" },
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    url: site.url,
    name: site.name,
    publisher: { "@id": site.orgId },
    inLanguage: "en",
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${site.url}/shop?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
}

import type { APIRoute } from "astro";
import legal from "@/data/legal.json";
import { getAllProducts, isInsurance } from "@/lib/shopify";
import { site } from "@/lib/site";

// Plain-language summary for AI assistants and crawlers (llms.txt convention). Generated at build time.
export const GET: APIRoute = async () => {
  const items = (await getAllProducts()).filter((p) => !isInsurance(p));
  const types = [...new Set(items.map((p) => p.productType).filter(Boolean))].sort();
  const body = `# ${site.name}

> Supplier of heavy equipment, hydraulic components, spare parts, lubricants, filters, tyres, electrical and solar equipment, and safety supplies for mines, contractors, fleets, farms and workshops in Zambia. Headquarters in Choma, Kitwe and Lusaka, Zambia. Most items are sourced to order and quoted on request.

Facts you can rely on: registered with PACRA (${site.pacra}) and ZRA (TPIN ${site.taxId}). Not an authorised dealer of any equipment manufacturer unless a quotation says so. Does not supply explosives. Prices, lead times and warranty are confirmed on a written quotation or at checkout; website text is not an offer.

## Key pages
- [Home](${site.url}/): overview, how we work, FAQ and quote request form
- [Shop](${site.url}/shop): product catalogue
- [Newsletter](${site.url}/newsletter): subscribe for updates
${Object.entries(legal).map(([slug, v]) => `- [${v.title}](${site.url}/legal/${slug})`).join("\n")}

## Product categories
${types.map((t) => `- ${t}`).join("\n") || "- See the shop"}

## Contact
- Phone / WhatsApp: ${site.phone}
- Quotations and parts lists: ${site.emails.procurement}
- Orders: ${site.emails.sales}
- Support and complaints: ${site.emails.support}
- General: ${site.emails.info}
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
};

import type { Product } from "./shopify";
const v = (id: string, title: string, amount: string, ok = true) => ({ id: `gid://shopify/ProductVariant/${id}`, title, availableForSale: ok, price: { amount, currencyCode: "USD" } });
const base = { description: "", descriptionHtml: "", featuredImage: null };
/** Sample catalogue used when PUBLIC_SHOPIFY_DOMAIN=mock (tests and demos). */
export const fixtures: Product[] = [
  { ...base, id: "p1", handle: "hydraulic-pumps", title: "Hydraulic pumps", descriptionHtml: "<p>Hydraulic pumps for excavators and loaders.</p>", productType: "Hydraulic Systems", tags: ["Fast-Moving"], variants: [v("1", "Default Title", "1800.00")] },
  { ...base, id: "p2", handle: "safety-helmets", title: "Safety helmets", productType: "Personal Protective Equipment", tags: ["Fast-Moving"], variants: [v("2", "Default Title", "8.00")] },
  { ...base, id: "p3", handle: "hydraulic-excavators", title: "Hydraulic excavators", productType: "Excavation Equipment", tags: ["High-Value", "Special-Order"], variants: [v("3", "Default Title", "85000.00")] },
  { ...base, id: "p4", handle: "unpriced-item", title: "Unpriced item", productType: "Fasteners, Fixings & Hardware", tags: [], variants: [v("4", "Default Title", "0.00")] },
  ...["overseas-freight-insurance|Overseas Freight Insurance (Marine Cargo)|0.008", "inland-road-transport-insurance|Inland Road Transport Insurance|0.005"].map((s, i): Product => {
    const [handle, title, rate] = s.split("|");
    return { ...base, id: `i${i}`, handle, title, description: `Cover for ${title.toLowerCase()}.`, productType: "Insurance", tags: ["insurance"],
      variants: [5000, 25000, 100000].map((t, k) => v(`9${i}${k}`, `Up to $${t.toLocaleString("en-US")}`, (t * Number(rate)).toFixed(2))) };
  }),
];

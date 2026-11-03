/** Single source of truth for business facts used in structured data and templates. */
export const site = {
  name: "Hydraumatics General Dealers",
  url: "https://hgdmachines.online",
  legalNotice: "Effective 31 October 2026",
  taxId: "1007272167",
  pacra: "320220041698",
  locality: "Choma",
  country: "ZM",
  emails: {
    info: "info@hgdmachines.online",
    procurement: "procurement@hgdmachines.online",
    sales: "sales@hgdmachines.online",
    support: "support@hgdmachines.online",
    news: "news@hgdmachines.online",
  },
  phone: "+260 95 438 1230",
  phoneTel: "+260954381230",
  whatsapp: "https://wa.me/260954381230",
  tagline: "Keeping operations moving across Africa.",
  hq: ["Choma", "Kitwe", "Lusaka"],
  orgId: "https://hgdmachines.online/#organization",
} as const;

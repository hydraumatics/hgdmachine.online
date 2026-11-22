import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTACT, newsletterConfirmation, quoteAcknowledgement, quoteNotification } from "../server/emails.js";
import { render } from "./emails-md.mjs";

const lead = { name: "Ada Mwansa, Procurement", ref: "HYD-261122-A1B2C3", company: "Test Mine", delivery: "CIF Ndola", urgency: "Standard", details: "2 x pump\nPN 708-2L-00300", phone: "+260 97 000 0000" };

describe("customer emails", () => {
  it("quote confirmation greets by first name, shows the reference and says what happens next", () => {
    const m = quoteAcknowledgement(lead);
    expect(m.subject).toBe("We have received your request HYD-261122-A1B2C3");
    expect(m.text).toContain("Hello Ada Mwansa,");
    expect(m.text).toContain("What happens next");
    expect(m.text).toContain("Your reference: HYD-261122-A1B2C3");
    expect(m.text).toContain(CONTACT.phone);
    expect(m.html).toContain("Your reference");
    expect(m.text).not.toMatch(/<[a-z]/i); // the plain-text version has no HTML
  });
  it("urgent requests promise a call, normal ones do not", () => {
    expect(quoteAcknowledgement({ ...lead, urgency: "Urgent: machine down" }).text).toContain("try to call you on +260 97 000 0000");
    expect(quoteAcknowledgement(lead).text).not.toContain("try to call you");
  });
  it("escapes customer input in the HTML and cuts very long messages", () => {
    const m = quoteAcknowledgement({ ...lead, name: "<b>Eve</b>", company: "<script>x</script>", details: "x".repeat(2000) });
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<b>Eve</b>");
    expect(m.text).toContain("…");
    expect(m.text.length).toBeLessThan(2000);
  });
  it("newsletter confirmation contains the link twice (button and plain)", () => {
    const m = newsletterConfirmation({ name: "Ada", link: "https://hgdmachines.online/api/newsletter/confirm?t=abc" });
    expect(m.html.split("confirm?t=abc").length - 1).toBe(2);
    expect(m.text).toContain("confirm?t=abc");
    expect(m.text).toContain("If you did not ask for this");
  });
});

describe("team email", () => {
  it("marks urgent requests in the subject", () => {
    expect(quoteNotification({ ...lead, urgency: "Urgent: machine down", email: "a@b.co" }).subject).toBe("[URGENT] Quote request HYD-261122-A1B2C3: Test Mine");
  });
});

describe("contact details", () => {
  it("match src/lib/site.ts", () => {
    const site = readFileSync(new URL("../src/lib/site.ts", import.meta.url), "utf8");
    for (const value of [CONTACT.phone, CONTACT.whatsapp, CONTACT.procurement, CONTACT.news, CONTACT.site, CONTACT.tagline]) expect(site).toContain(value);
  });
});

describe("EMAILS.md", () => {
  it("is up to date (run: bun run emails)", () => {
    expect(readFileSync(new URL("../EMAILS.md", import.meta.url), "utf8")).toBe(render());
  });
});

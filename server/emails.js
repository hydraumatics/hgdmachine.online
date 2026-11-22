// Every email the website sends to a customer, in one place. Edit the wording here, then run `bun run emails`
// to refresh EMAILS.md (a readable copy of what goes out). Each template returns { subject, html, text }.
import { esc } from "./shared.js";

// Keep in sync with src/lib/site.ts (scripts/emails.test.mjs checks this).
export const CONTACT = {
  company: "Hydraumatics General Dealers",
  tagline: "Keeping operations moving across Africa.",
  site: "https://hgdmachines.online",
  phone: "+260 95 438 1230",
  whatsapp: "https://wa.me/260954381230",
  procurement: "procurement@hgdmachines.online",
  news: "news@hgdmachines.online",
  places: "Choma · Kitwe · Lusaka, Zambia",
};

const NAVY = "#0f2a43", GOLD = "#cf9931", PAPER = "#f6f6f1", INK = "#1c2733", MUTED = "#5a6672";
const greeting = (name) => String(name || "").split(",")[0].trim() || "there";
const cut = (s, n) => (String(s).length > n ? `${String(s).slice(0, n).trimEnd()}…` : String(s));
const para = (s) => `<p style="margin:0 0 14px">${s}</p>`;
const lines = (s) => esc(s).replace(/\r?\n/g, "<br>");
const indent = (s) => String(s).split(/\r?\n/).map((l) => `  ${l}`).join("\n");

function layout(bodyHtml, footerHtml) {
  return `<div style="background:${PAPER};padding:24px 12px"><div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e3e1d8;font:16px/1.55 Arial,Helvetica,sans-serif;color:${INK}">`
    + `<div style="background:${NAVY};padding:18px 24px;border-bottom:3px solid ${GOLD}"><span style="color:#ffffff;font-size:20px;font-weight:bold">${CONTACT.company}</span></div>`
    + `<div style="padding:24px 24px 8px">${bodyHtml}</div>`
    + `<div style="padding:16px 24px;background:${PAPER};color:${MUTED};font-size:13px;line-height:1.5">${footerHtml}</div></div></div>`;
}

/** To the customer, right after they send the quote form. */
export function quoteAcknowledgement({ name, ref, company, delivery, urgency, details, phone }) {
  const urgent = /^urgent/i.test(urgency || "");
  const subject = `We have received your request ${ref}`;
  const next = [
    "We check the part numbers, quantities and delivery terms.",
    "We reply by email with a quotation, or with the few questions we need answered first. This is usually within one working day.",
    urgent
      ? `Because you marked this as urgent, we will try to call you${phone ? ` on ${phone}` : ""} as soon as we have looked at it.`
      : "If anything is missing, we will ask you before we quote, so nothing is guessed.",
  ];
  const sooner = `Need us sooner? Call or WhatsApp ${CONTACT.phone}, or just reply to this email. Please mention your reference ${ref}.`;
  const small = `This is an automatic confirmation that we received your request. It is not a quotation or an order confirmation. We only use your details to answer your request (privacy notice: ${CONTACT.site}/legal/privacy).`;

  const text = [
    `Hello ${greeting(name)},`, "",
    `Thank you for contacting ${CONTACT.company}. We have received your request and our procurement team will look at it now.`, "",
    `Your reference: ${ref}`, "",
    "What happens next", ...next.map((n, i) => `${i + 1}. ${n}`), "",
    "What you sent us",
    `  Company or site: ${company}`, `  Delivery terms: ${delivery || "-"}`, `  Urgency: ${urgency || "-"}`,
    "  Your message:", indent(cut(details, 700)), "",
    sooner, "",
    "Kind regards", "Procurement team", CONTACT.company, CONTACT.tagline, CONTACT.places, "",
    small,
  ].join("\n");

  const html = layout(
    para(`Hello ${esc(greeting(name))},`)
    + para(`Thank you for contacting ${CONTACT.company}. We have received your request and our procurement team will look at it now.`)
    + `<div style="margin:0 0 18px;padding:12px 16px;background:${PAPER};border-left:4px solid ${GOLD}"><span style="font-size:13px;color:${MUTED}">Your reference</span><br><span style="font-size:22px;font-weight:bold;letter-spacing:.5px;color:${NAVY}">${esc(ref)}</span></div>`
    + `<p style="margin:0 0 6px;font-weight:bold">What happens next</p>`
    + `<ol style="margin:0 0 18px;padding-left:22px">${next.map((n) => `<li style="margin:0 0 6px">${esc(n)}</li>`).join("")}</ol>`
    + `<p style="margin:0 0 6px;font-weight:bold">What you sent us</p>`
    + `<p style="margin:0 0 8px;font-size:15px">Company or site: ${esc(company)}<br>Delivery terms: ${esc(delivery || "-")}<br>Urgency: ${esc(urgency || "-")}</p>`
    + `<div style="margin:0 0 18px;padding:10px 14px;border-left:3px solid #d9d6cb;color:#33414f;font-size:15px">${lines(cut(details, 700))}</div>`
    + para(`Need us sooner? Call or <a href="${CONTACT.whatsapp}" style="color:${NAVY}">WhatsApp ${esc(CONTACT.phone)}</a>, or just reply to this email. Please mention your reference <b>${esc(ref)}</b>.`)
    + `<p style="margin:0 0 18px">Kind regards<br><b>Procurement team</b><br>${CONTACT.company}<br><span style="color:${MUTED}">${CONTACT.tagline}<br>${CONTACT.places}</span></p>`,
    `${esc(small).replace(esc(`${CONTACT.site}/legal/privacy`), `<a href="${CONTACT.site}/legal/privacy" style="color:${MUTED}">${CONTACT.site}/legal/privacy</a>`)}`,
  );
  return { subject, html, text };
}

/** To the subscriber, when double opt-in is on. */
export function newsletterConfirmation({ name, link }) {
  const subject = "Please confirm your subscription";
  const text = [
    `Hello${name ? ` ${greeting(name)}` : ""},`, "",
    `Thank you for signing up to the ${CONTACT.company} newsletter. One click and you are on the list:`, "",
    link, "",
    "If you did not ask for this, ignore this email. You will not be subscribed and we will not write to you again.", "",
    "Kind regards", CONTACT.company, CONTACT.places,
  ].join("\n");
  const html = layout(
    para(`Hello${name ? ` ${esc(greeting(name))}` : ""},`)
    + para(`Thank you for signing up to the ${CONTACT.company} newsletter. One click and you are on the list:`)
    + `<p style="margin:0 0 18px"><a href="${esc(link)}" style="display:inline-block;background:${GOLD};color:${NAVY};font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:6px">Confirm my subscription</a></p>`
    + `<p style="margin:0 0 18px;font-size:14px;color:${MUTED}">Button not working? Copy this link into your browser:<br>${esc(link)}</p>`
    + `<p style="margin:0 0 18px">Kind regards<br><b>${CONTACT.company}</b><br><span style="color:${MUTED}">${CONTACT.places}</span></p>`,
    "If you did not ask for this, ignore this email. You will not be subscribed and we will not write to you again.",
  );
  return { subject, html, text };
}

/** To our own team, for every quote request (plain text, easy to scan; reply goes to the customer). */
export function quoteNotification({ ref, name, company, email, phone, delivery, urgency, details }) {
  const urgent = /^urgent/i.test(urgency || "");
  const subject = `${urgent ? "[URGENT] " : ""}Quote request ${ref}: ${company}`;
  const text = [
    `Reference: ${ref}`, `Name and title: ${name}`, `Company or site: ${company}`, `Email: ${email}`, `Phone: ${phone || "-"}`,
    `Delivery terms: ${delivery}`, `Urgency: ${urgency}`, "Consent: given (Privacy notice)", "", "Requirement:", details, "",
    "Reply to this email to answer the customer. Please keep the reference in the subject.",
  ].join("\n");
  return { subject, text };
}

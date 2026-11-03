import { describe, expect, it } from "vitest";
import { EMAIL_RE, csvCell, esc, makeRef, safeEqual, toCsv } from "./shared.js";

describe("server helpers", () => {
  it("validates emails", () => {
    expect(EMAIL_RE.test("buyer@mine.co.zm")).toBe(true);
    expect(EMAIL_RE.test("not an email")).toBe(false);
  });
  it("escapes html", () => expect(esc("<b>&")).toBe("&lt;b&gt;&amp;"));
  it("neutralises CSV formula injection and quotes commas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("a,b")).toBe('"a,b"');
  });
  it("builds CSV", () => expect(toCsv([{ a: 1, b: "x" }])).toBe("a,b\n1,x"));
  it("compares secrets safely", async () => {
    expect(await safeEqual("abc", "abc")).toBe(true);
    expect(await safeEqual("abc", "abd")).toBe(false);
  });
  it("makes references", () => expect(makeRef()).toMatch(/^HYD-\d{6}-[0-9A-F]{6}$/));
});

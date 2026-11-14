import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MAX_WIDTH, convertAll, listSources, needsWork, pending, targetsFor } from "./images-lib.mjs";

let dir;
const png = (name, width, height) => sharp({ create: { width, height, channels: 3, background: "#cc3300" } }).png().toFile(join(dir, name));

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "images-"));
  mkdirSync(join(dir, "nested"));
  await png("small.png", 40, 30);
  await png("wide.PNG", MAX_WIDTH + 600, 40);
  await sharp({ create: { width: 20, height: 20, channels: 3, background: "#003366" } }).jpeg().toFile(join(dir, "nested", "photo.jpg"));
  writeFileSync(join(dir, "notes.txt"), "not an image");
  writeFileSync(join(dir, "already.webp"), "ignored: webp is not a source");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const meta = (file) => sharp(join(dir, file)).metadata();

describe("image conversion", () => {
  it("lists only jpg/jpeg/png sources, recursively and case-insensitively", () => {
    const names = listSources([dir]).map((f) => f.slice(dir.length + 1));
    expect(names).toEqual(["nested/photo.jpg", "small.png", "wide.PNG"]);
    expect(listSources([join(dir, "missing")])).toEqual([]);
  });
  it("maps a source to avif and webp siblings", () => {
    expect(targetsFor("public/images/hero.jpg").map((t) => t.out)).toEqual(["public/images/hero.avif", "public/images/hero.webp"]);
  });
  it("reports everything as pending before the first run", () => {
    expect(pending([dir])).toHaveLength(6);
  });
  it("converts every image to AVIF and WebP", async () => {
    const result = await convertAll({ dirs: [dir] });
    expect(result.failed).toEqual([]);
    expect(result.converted).toHaveLength(6);
    expect((await meta("small.avif")).format).toBe("heif");
    expect((await meta("small.webp")).format).toBe("webp");
    expect((await meta("nested/photo.webp")).format).toBe("webp");
    expect(pending([dir])).toEqual([]);
  });
  it("never upscales, and shrinks oversized images to the maximum width", async () => {
    expect((await meta("small.webp")).width).toBe(40);
    expect((await meta("wide.webp")).width).toBe(MAX_WIDTH);
  });
  it("skips up-to-date outputs on the next run and redoes them with force", async () => {
    const again = await convertAll({ dirs: [dir] });
    expect(again.converted).toEqual([]);
    expect(again.skipped).toHaveLength(6);
    expect((await convertAll({ dirs: [dir], force: true })).converted).toHaveLength(6);
  });
  it("converts again when the source is newer than its output", async () => {
    const src = join(dir, "small.png"), out = join(dir, "small.webp");
    const future = new Date(statSync(out).mtimeMs + 60_000);
    utimesSync(src, future, future);
    expect(needsWork(src, out)).toBe(true);
    expect((await convertAll({ dirs: [dir] })).converted.map((f) => f.slice(dir.length + 1)).sort()).toEqual(["small.avif", "small.webp"]);
  });
});

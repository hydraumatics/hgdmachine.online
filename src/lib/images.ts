import fs from "node:fs";
import type { ImageMetadata } from "astro";

const assets = import.meta.glob<{ default: ImageMetadata }>("/src/assets/images/*.{jpg,jpeg,png,webp,avif,svg}", { eager: true });

/** Where each photo's subject sits, used by object-position when the box crops it (edit to taste). */
export const imageFocus: Record<string, string> = {
  hero: "70% 50%",
  "how-we-work": "80% 50%",
  "kelly-mafuta": "50% 25%",
};

export interface FoundImage { meta?: ImageMetadata; publicSrc?: string }

/** Looks in src/assets/images first (optimised), then public/images (plain file). Returns {} when missing. */
export function findImage(name: string): FoundImage {
  const key = Object.keys(assets).find((k) => k.split("/").pop()?.replace(/\.[^.]+$/, "") === name);
  if (key) return { meta: assets[key].default };
  for (const ext of ["jpg", "jpeg", "png", "webp", "avif", "svg"]) {
    if (fs.existsSync(`public/images/${name}.${ext}`)) return { publicSrc: `/images/${name}.${ext}` };
  }
  return {};
}

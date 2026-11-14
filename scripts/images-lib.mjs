// Image conversion helpers for `bun run images` (see scripts/convert-images.mjs).
// Pure helpers live here so they can be unit-tested; sharp is imported lazily.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, parse } from "node:path";

export const DEFAULT_DIRS = ["public/images"];
export const SOURCE_RE = /\.(jpe?g|png)$/i;
export const MAX_WIDTH = 2400;
export const FORMATS = [
  { ext: "avif", options: { quality: 55, effort: 4 } },
  { ext: "webp", options: { quality: 78 } },
];

/** All jpg/jpeg/png files below the given directories (recursive, sorted, missing dirs ignored). */
export function listSources(dirs = DEFAULT_DIRS) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (SOURCE_RE.test(entry.name)) out.push(full);
    }
  };
  dirs.forEach(walk);
  return out.sort();
}

/** The files produced from one source image: hero.jpg -> hero.avif, hero.webp (same folder). */
export function targetsFor(file) {
  const { dir, name } = parse(file);
  return FORMATS.map((f) => ({ ...f, out: join(dir, `${name}.${f.ext}`) }));
}

/** True when the output is missing or older than its source. */
export function needsWork(src, out) {
  return !existsSync(out) || statSync(out).mtimeMs < statSync(src).mtimeMs;
}

/** Outputs that are missing or stale (used by `--check`). */
export function pending(dirs = DEFAULT_DIRS) {
  return listSources(dirs).flatMap((src) => targetsFor(src).filter((t) => needsWork(src, t.out)).map((t) => ({ src, ...t })));
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} kB`;

/** Converts everything that needs it. Returns { converted, skipped, failed } (arrays of output paths / errors). */
export async function convertAll({ dirs = DEFAULT_DIRS, force = false, log = () => {} } = {}) {
  const { default: sharp } = await import("sharp");
  const result = { converted: [], skipped: [], failed: [] };
  for (const src of listSources(dirs)) {
    for (const t of targetsFor(src)) {
      if (!force && !needsWork(src, t.out)) { result.skipped.push(t.out); continue; }
      try {
        await sharp(src).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true })[t.ext](t.options).toFile(t.out);
        result.converted.push(t.out);
        log(`${src} (${kb(statSync(src).size)}) -> ${t.out} (${kb(statSync(t.out).size)})`);
      } catch (error) {
        result.failed.push({ out: t.out, error: String(error) });
      }
    }
  }
  return result;
}

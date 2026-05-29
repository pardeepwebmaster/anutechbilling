/**
 * One-shot script: capture full-page screenshot of the landing page.
 * Run with `node scripts/screenshot-landing.mjs`.
 *
 * Saves:
 *   - landing-desktop-full.png  (1440×fullpage)
 *   - landing-mobile-full.png   (390×fullpage)
 *
 * Requires preview server on localhost:3000 with ?preview=1 query support.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "..", "screenshots");
mkdirSync(outDir, { recursive: true });

const url = "http://localhost:3000/?preview=1";

async function shoot(viewport, filename) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  // Give fonts a beat to render
  await page.waitForTimeout(800);
  const out = resolve(outDir, filename);
  await page.screenshot({ path: out, fullPage: true, type: "png" });
  console.log(`saved ${filename} (${viewport.width}×${viewport.height})`);
  await browser.close();
}

await shoot({ width: 1440, height: 900 }, "landing-desktop-full.png");
await shoot({ width: 390, height: 800 },  "landing-mobile-full.png");
console.log(`\nall saved to: ${outDir}`);

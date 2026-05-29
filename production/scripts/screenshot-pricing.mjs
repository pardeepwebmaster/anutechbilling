/**
 * Capture full-page screenshot of /pricing.
 * Run: node scripts/screenshot-pricing.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "..", "screenshots");
mkdirSync(outDir, { recursive: true });

const url = "http://localhost:3000/pricing";

async function shoot(viewport, filename) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const out = resolve(outDir, filename);
  await page.screenshot({ path: out, fullPage: true, type: "png" });
  console.log(`saved ${filename} (${viewport.width}×${viewport.height})`);
  await browser.close();
}

await shoot({ width: 1440, height: 900 }, "pricing-desktop-full.png");
await shoot({ width: 390, height: 800 },  "pricing-mobile-full.png");
console.log(`\nall saved to: ${outDir}`);

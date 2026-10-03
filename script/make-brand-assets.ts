// Regenerates the favicon, app icons and social-preview image in client/public from the Cel logo mark.
//   pnpm assets:brand
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "client", "public");
mkdirSync(out, { recursive: true });

// Same geometry as client/src/components/CelLogo.tsx (32x32 box): onion-skin "C" with film sprockets.
const mark = (color: string) => `
  <g fill="none" stroke="${color}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 6 C28 6 28 26 22 26" stroke-opacity="0.3" stroke-width="1.5"/>
    <path d="M20 8 C24 8 24 24 20 24" stroke-opacity="0.5" stroke-width="1.5"/>
    <path d="M18 10 C22 10 22 22 18 22" stroke-opacity="0.7" stroke-width="1.5"/>
    <path d="M16 12 C19 12 19 20 16 20" stroke-width="2"/>
  </g>
  <g fill="${color}" opacity="0.9">
    <rect x="6" y="8" width="3" height="3" rx="0.75"/>
    <rect x="6" y="14.5" width="3" height="3" rx="0.75"/>
    <rect x="6" y="21" width="3" height="3" rx="0.75"/>
  </g>`;

const BG = "#0f172a";
const icon = (radius: number, size = 32) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${radius}" fill="${BG}"/>
  <g transform="translate(16 16) scale(1.2) translate(-16.2 -16)">${mark("#ffffff")}</g>
</svg>`;

writeFileSync(resolve(out, "favicon.svg"), icon(7));

async function png(name: string, size: number, svg: (size: number) => string) {
  const canvas = createCanvas(size, size);
  // The SVG is rasterised at its declared size, so declare the target size or small sources get upscaled and blur.
  canvas.getContext("2d").drawImage(await loadImage(Buffer.from(svg(size))), 0, 0, size, size);
  writeFileSync(resolve(out, name), canvas.toBuffer("image/png"));
}
await png("favicon.png", 48, (n) => icon(7, n));
await png("icon-192.png", 192, (n) => icon(7, n));
await png("icon-512.png", 512, (n) => icon(7, n));
await png("apple-touch-icon.png", 180, (n) => icon(0, n)); // iOS applies its own corner mask

// 1200x630 social preview
const W = 1200, H = 630;
const og = createCanvas(W, H);
const ctx = og.getContext("2d");
const gradient = ctx.createLinearGradient(0, 0, W, H);
gradient.addColorStop(0, "#e7f1ff");
gradient.addColorStop(1, "#f1e9ff");
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, W, H);
const logo = await loadImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 32 32">${mark(BG)}</svg>`));
ctx.drawImage(logo, 90, 90, 96, 96);
ctx.fillStyle = BG;
ctx.font = "bold 64px sans-serif";
ctx.fillText("Cel", 204, 160);
ctx.font = "bold 92px sans-serif";
ctx.fillText("Make your animation.", 90, 340);
ctx.fillStyle = "#0284c7";
ctx.fillText("Not your spreadsheet.", 90, 450);
ctx.fillStyle = "#475569";
ctx.font = "34px sans-serif";
ctx.fillText("Storyboards, animatics, review and commissions in one place.", 90, 535);
writeFileSync(resolve(out, "og-image.png"), og.toBuffer("image/png"));

writeFileSync(resolve(out, "manifest.webmanifest"), JSON.stringify({
  name: "Cel",
  short_name: "Cel",
  description: "The production hub for animators: script, storyboard, animatic, review and ship.",
  start_url: "/#/dashboard",
  scope: "/",
  display: "standalone",
  background_color: "#f4f4f5",
  theme_color: BG,
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2) + "\n");

writeFileSync(resolve(out, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /api/\n");
console.log("wrote brand assets to", out);

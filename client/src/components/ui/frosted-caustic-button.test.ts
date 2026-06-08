import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("client/src/index.css", "utf8");
const button = readFileSync("client/src/components/ui/button.tsx", "utf8");
const glassButton = readFileSync("client/src/components/ui/glass-button.tsx", "utf8");
const quickCaptureFab = readFileSync("client/src/components/quick-capture-fab.tsx", "utf8");

assert.match(css, /--shadow-apple:/, "shared theme exposes Apple-style elevation tokens");
assert.match(css, /--cel-tint-rose:/, "shared theme exposes subtle rose wash");
assert.match(css, /--cel-tint-sage:/, "shared theme exposes subtle sage wash");
assert.match(css, /--cel-tint-lilac:/, "shared theme exposes subtle lilac wash");
assert.match(css, /\.glass[\s\S]*backdrop-filter: blur/, "glass surfaces use frosted blur");

assert.match(css, /\.cel-soft-button\[data-variant="default"\][\s\S]*var\(--neu-glass-bg\)/, "default buttons use frosted glass background");
assert.match(css, /\.chip-sage/, "status chips include sage variant");

assert.match(button, /children,[\s\S]*<span className="relative z-\[2\]/, "standard Button content is raised above optical pseudo-layers");
assert.match(glassButton, /data-caustic-glass/, "GlassButton marks instances for caustic material styling");
assert.match(glassButton, /data-glass-size=\{size \?\? "md"\}/, "GlassButton keeps size API stable while exposing round styling hooks");
assert.match(glassButton, /var\(--shadow-soft\)/, "GlassButton applies shared soft elevation shadow");
assert.match(glassButton, /backdrop-blur-\[24px\]/, "GlassButton primary variant uses frosted blur");
assert.match(quickCaptureFab, /<GlassButton[\s\S]*size="round"/, "the floating icon-only capture control uses the shared round glass button primitive");
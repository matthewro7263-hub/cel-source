import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("client/src/index.css", "utf8");
const button = readFileSync("client/src/components/ui/button.tsx", "utf8");
const glassButton = readFileSync("client/src/components/ui/glass-button.tsx", "utf8");

assert.match(css, /--neu-glass-material:/, "shared theme exposes a layered frosted glass material token");
assert.match(css, /--neu-glass-caustic:/, "shared theme exposes a soft white center caustic token");
assert.match(css, /--neu-glass-refraction:/, "shared theme exposes a pastel rim/refraction token");
assert.match(css, /--neu-shadow-caustic-raised:/, "shared theme exposes the raised caustic shadow stack");

assert.match(css, /\.cel-soft-button::before[\s\S]*var\(--neu-glass-caustic\)/, "core buttons render a center caustic layer");
assert.match(css, /\.cel-soft-button::after[\s\S]*var\(--neu-glass-refraction\)/, "core buttons render a rim refraction layer");
assert.match(css, /\.cel-soft-button\[data-variant="default"\][\s\S]*var\(--neu-glass-material\)/, "default buttons use the shared glass material");
assert.match(css, /\.cel-soft-button\[data-variant="outline"\][\s\S]*var\(--neu-glass-material\)/, "outline buttons use the shared glass material");

assert.match(button, /children,[\s\S]*<span className="relative z-\[2\]/, "standard Button content is raised above optical pseudo-layers");
assert.match(glassButton, /data-caustic-glass/, "GlassButton marks instances for caustic material styling");
assert.match(glassButton, /data-glass-size=\{size \?\? "md"\}/, "GlassButton keeps size API stable while exposing round styling hooks");
assert.match(glassButton, /var\(--neu-glass-caustic\)/, "GlassButton includes the same center caustic layer as core buttons");
assert.match(glassButton, /var\(--neu-glass-refraction\)/, "GlassButton includes the same rim refraction layer as core buttons");

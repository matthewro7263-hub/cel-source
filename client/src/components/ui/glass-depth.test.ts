import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("client/src/index.css", "utf8");
const liquidGlass = readFileSync("client/src/components/ui/liquid-glass.tsx", "utf8");
const dialog = readFileSync("client/src/components/ui/dialog.tsx", "utf8");
const sheet = readFileSync("client/src/components/ui/sheet.tsx", "utf8");
const login = readFileSync("client/src/pages/Login.tsx", "utf8");
const signup = readFileSync("client/src/pages/Signup.tsx", "utf8");
const projectFrame = readFileSync("client/src/components/layout/project-frame.tsx", "utf8");
const appShell = readFileSync("client/src/components/AppShell.tsx", "utf8");
const landing = readFileSync("client/src/pages/Landing.tsx", "utf8");
const glassCapability = readFileSync("client/src/lib/glassCapability.ts", "utf8");
const useLiquidGL = readFileSync("client/src/hooks/useLiquidGL.ts", "utf8");

assert.match(css, /--glass-depth-shadow:/, "depth shadow token exists");
assert.match(css, /\.liquid-glass-bevel/, "bevel layer class exists");
assert.match(css, /\.liquid-glass-chroma/, "chroma layer class exists");
assert.match(css, /\.liquid-glass-lift/, "lift layer class exists");
assert.match(css, /\.liquid-glass-host/, "host stacking class exists");
assert.match(css, /\.liquid-glass-css-fallback/, "css fallback class exists");
assert.match(css, /@supports not/, "backdrop-filter fallback block exists");

assert.match(liquidGlass, /depth\?:\s*LiquidGlassDepth/, "depth prop typed");
assert.match(liquidGlass, /DEPTH_PRESETS/, "depth preset map exists");
assert.match(liquidGlass, /liquid-glass-chroma/, "renders chroma layer");
assert.match(liquidGlass, /liquid-glass-bevel/, "renders bevel layer");
assert.match(liquidGlass, /liquid-glass-lift/, "renders lift layer");
assert.match(liquidGlass, /data-glass-depth/, "depth data attribute");
assert.match(liquidGlass, /z-0/, "overlay mode pins decorative layer below content");

assert.match(glassCapability, /shouldUseWebGL/, "capability helper exports shouldUseWebGL");
assert.match(useLiquidGL, /clearLiquidReadyFlags/, "hook clears ready flags");
assert.match(useLiquidGL, /teardownLiquidGL/, "hook tears down renderer");

assert.match(dialog, /depth=["']strong["']/, "dialog uses strong depth");
assert.match(dialog, /fixed left-\[50%\]/, "dialog content stays fixed positioned");
assert.doesNotMatch(dialog, /relative glass-strong/, "dialog avoids relative+fixed stacking conflict");
assert.match(sheet, /depth=["']strong["']/, "sheet uses strong depth");
assert.doesNotMatch(sheet, /relative glass-strong/, "sheet avoids relative+fixed stacking conflict");
assert.match(login, /depth=["']strong["']/, "login uses strong depth");
assert.match(signup, /depth=["']strong["']/, "signup uses strong depth");
assert.match(projectFrame, /depth=["']normal["']/, "project quick actions use normal depth");
assert.match(appShell, /depth=["']normal["']/, "user pill uses normal depth");
assert.match(appShell, /className="relative overflow-hidden w-full[\s\S]*data-testid="button-user-menu"/, "user pill clips glass overlay");
assert.match(appShell, /relative z-\[1\].*flex w-full items-center/, "user pill content sits above overlay");
assert.match(appShell, /liquid-glass-host/, "sidebar uses liquid-glass-host");
assert.match(appShell, /data-glass-depth=["']normal["']/, "sidebar declares normal depth");
assert.doesNotMatch(appShell, /liquid-gl-ambient/, "dead ambient div removed");
assert.match(landing, /liquid-glass-host/, "landing nav uses liquid-glass-host");
assert.match(landing, /isolate overflow-hidden/, "landing nav owns stacking context");
assert.match(landing, /data-glass-depth=["']normal["']/, "landing nav declares normal depth");
assert.match(landing, /data-liquid-tilt=["']true["']/, "landing nav enables tilt");
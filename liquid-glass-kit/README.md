# Liquid Glass Kit

A small, framework-free liquid glass refraction kit inspired by Aave's web write-up on bending live HTML with `feDisplacementMap`. It is built to be dropped into ordinary websites, tuned with HTML data attributes, and demoed locally with Vite.

## What it recreates

The toolbox follows the same core idea described in Aave's article:

- Render your real DOM normally.
- Generate a rounded-rectangle displacement PNG in JavaScript.
- Feed that map into an SVG `feDisplacementMap` filter.
- Move only the map/lens position while keeping the expensive map generation for shape changes.
- Add CSS rim lighting, chromatic edge glow, blur, and specular highlights so the result feels like curved glass.

This package does **not** copy Aave's private production code. It is an original implementation of the public technique that you can inspect, tune, and ship.

## Files

```text
src/liquid-glass.js   # LiquidGlass class, auto-attacher, displacement-map generator
src/liquid-glass.css  # Lens shell, rim/specular/chromatic highlight styling
demo/main.js          # Demo wiring for the playground and slider pattern
index.html            # Vite-powered demo page
```

## Quick start

Install and run the demo:

```bash
npm install
npm run dev
```

Then open the local URL Vite prints in your terminal. The demo includes:

1. A pointer-following card lens that refracts live text and UI.
2. Controls for lens width, height, radius, depth, curvature, splay, chroma, blur, glow, edge highlight, scale, and specular angle.
3. Slider, switch, segmented control, elastic button, QR canvas, and video-control recipes.

Use the Vite server for local preview. Opening `index.html` through `file://` is not the intended path because module imports, asset URLs, and browser security rules are more reliable from `http://localhost`.

## Add to any website

Import the CSS and JavaScript module:

```html
<link rel="stylesheet" href="/src/liquid-glass.css" />
<script type="module">
  import { attachLiquidGlass } from '/src/liquid-glass.js';

  attachLiquidGlass('[data-liquid-glass]');
</script>
```

Mark up any live DOM you want to refract:

```html
<div
  data-liquid-glass
  data-lg-fit="block"
  data-lg-follow="true"
  data-lg-width="210"
  data-lg-height="140"
  data-lg-radius="46"
  data-lg-scale="42"
>
  <h2>Live HTML stays selectable</h2>
  <p>The lens bends this real rendered content.</p>
</div>
```

Or instantiate manually for complete control:

```js
import { LiquidGlass } from './src/liquid-glass.js';

const glass = new LiquidGlass(document.querySelector('.card'), {
  lensW: 180,
  lensH: 112,
  borderRadius: 36,
  x: 0.5,
  y: 0.5,
  scale: 36,
  depth: 1,
  curvature: 4,
  splay: 1,
  chroma: 0.22,
  blur: 0.35,
  glow: 0.28,
  followPointer: true,
  fit: 'block',
});

glass.setPosition(0.25, 0.5);
glass.update({ scale: 18, borderRadius: 28 });
```

## Options and data attributes

| JavaScript option | Data attribute | Default | Purpose |
| --- | --- | ---: | --- |
| `lensW` | `data-lg-width` | `180` | Lens width in pixels. |
| `lensH` | `data-lg-height` | `112` | Lens height in pixels. |
| `borderRadius` | `data-lg-radius` | `36` | Rounded-rectangle radius. |
| `x` | `data-lg-x` | `0.5` | Horizontal lens center from `0` to `1`. |
| `y` | `data-lg-y` | `0.5` | Vertical lens center from `0` to `1`. |
| `scale` | `data-lg-scale` | `48` | SVG displacement strength. See unit note below. |
| `depth` | `data-lg-depth` | `1.4` | Overall bend intensity in the generated map. See unit note below. |
| `curvature` | `data-lg-curvature` | `4` | How quickly the lens falls off toward the rim. See unit note below. |
| `splay` | `data-lg-splay` | `1` | Extra edge bending for a curved-glass feel. |
| `chroma` | `data-lg-chroma` | `0.05` | Chromatic aberration amount. Any value `> 0` enables the per-channel refraction split. |
| `blur` | `data-lg-blur` | `0.35` | CSS backdrop blur on the lens shell. |
| `glow` | `data-lg-glow` | `0.28` | Specular glow opacity. |
| `edge` | `data-lg-edge` | `0.34` | Rim stroke opacity. |
| `specularAngle` | `data-lg-specular-angle` | `135` | Highlight angle in degrees. |
| `followPointer` | `data-lg-follow="true"` | `false` | Move lens with pointer. |
| `fit` | `data-lg-fit="block"` | `inline` | Use block layout for full-width components. |

### Unit conventions

`depth`, `curvature`, and `scale` each accept two ranges so you can use either small "physical" values or the larger slider-style values from the demo:

- `depth`: `<= 3` is a direct bend factor; larger values (for example `0`–`100` sliders) are scaled down by `60` into the same range.
- `curvature`: `<= 10` is a direct falloff factor; larger values (for example `0`–`100` sliders) are scaled down by `20`.
- `scale`: when `|scale| <= 1` it is treated as a fraction of the target's smaller side; larger values are absolute SVG displacement pixels.

## Component recipes

### Pointer magnifier

Use `followPointer: true` and a larger `scale` for a dramatic, tactile card lens.

```js
new LiquidGlass(card, {
  lensW: 220,
  lensH: 150,
  borderRadius: 52,
  followPointer: true,
  scale: 44,
});
```

### Slider thumb

Keep the map shape stable and only move the lens position from the range value. This mirrors the performance pattern Aave describes: regenerate maps on shape changes, not ordinary movement.

```js
const glass = new LiquidGlass(track, {
  lensW: 78,
  lensH: 54,
  borderRadius: 28,
  scale: 12,
  fit: 'block',
});

range.addEventListener('input', () => {
  glass.setPosition(Number(range.value) / 100, 0.5);
});
```

### Toggle selection pill

Use one wrapper around the whole toggle group and spring/ease the `x` position toward the selected option.

```js
const glass = new LiquidGlass(toggleGroup, {
  lensW: 120,
  lensH: 52,
  borderRadius: 999,
  scale: 18,
});

glass.setPosition(selectedIndex / (optionCount - 1), 0.5);
```

### Switch and segmented pulse

`SwitchGlass` and `ToggleGroupGlass` use the same interaction rhythm:

1. Start as a normal white pill.
2. Fade the white pill out while the glass lens scales up.
3. Peak halfway through a roughly `650ms` pulse.
4. Land at the destination and fade back to the white pill.

```js
new SwitchGlass(document.querySelector('#switch-demo'));
new ToggleGroupGlass(document.querySelector('#toggle-demo'));
```

## Browser notes

- Tested target: current Chrome, Edge, Firefox, and Safari on desktop-class browsers.
- Required platform features: ES modules, Canvas 2D, SVG filters with `feDisplacementMap`, CSS `filter`, CSS variables, Pointer Events, and `requestAnimationFrame`.
- Enhanced visuals use `backdrop-filter`, CSS masks, and WebGL for the Safari video fallback. The CSS includes `-webkit-` mask/backdrop prefixes where they matter.
- `feImage` is given both `href` and `xlink:href` so older WebKit resolves the displacement map.
- Engines without `backdrop-filter` get a denser lens fill via `@supports`, so the lens still reads as frosted glass without the backdrop blur.
- Displacement maps are generated at a capped internal resolution (160px max dimension) and stretched by the filter; the SDF field upscales cleanly, and map generation stays cheap even for large lenses.
- Component springs cache all layout metrics (refreshed by `ResizeObserver`), so animation frames perform no forced reflows; shape changes are coalesced to at most one map regeneration per frame.
- Draggable controls ship with `touch-action: none` so Pointer Events drive the springs reliably on touch devices.
- The DOM path works best on moderately sized surfaces. Wrap the smallest area that needs glass rather than filtering an entire page.
- Safari can cache filter output aggressively. The toolbox refreshes the filter ID when the displacement map is regenerated.
- Live video/canvas surfaces may need a WebGL renderer because browser filter pipelines do not expose every GPU-composited pixel source consistently.
- If a browser cannot apply the SVG filter, the lens still renders as a styled glass surface; lower `scale` and increase the CSS background opacity on `.liquid-glass__lens` for a harder fallback.
- For touch devices, keep `touch-action: none` on draggable controls so Pointer Events can drive the spring interaction reliably.

## Build

```bash
npm run build
```

The Vite build emits the demo to `dist/`. For a production app, copy `src/liquid-glass.js` and `src/liquid-glass.css` into your bundle or publish them as a small package.

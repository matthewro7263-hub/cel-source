const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';
const DEFAULTS = {
  lensW: 180,
  lensH: 112,
  borderRadius: 36,
  x: 0.5,
  y: 0.5,
  scale: 48,
  depth: 1.4,
  curvature: 4,
  splay: 1,
  chroma: 0.05,
  blur: 0.35,
  glow: 0.28,
  edge: 0.34,
  specularAngle: 135,
  followPointer: false,
  fit: 'inline',
};

let instanceCount = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toNumber = (value, fallback) => {
  if (value == null || value === '' || (typeof value === 'string' && value.trim() === '')) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// The kit accepts two unit conventions for the map-shaping inputs so authors can use
// either small "physical" values or the larger slider-style values from the demo:
//   - depth:     <= 3   is treated as a direct bend factor; larger values (e.g. 0..100
//                       sliders) are scaled down by 60 into the same range.
//   - curvature: <= 10  is a direct falloff factor; larger values (0..100 sliders) are
//                       scaled down by 20.
//   - scale:     |scale| <= 1 is treated as a fraction of the target's smaller side;
//                       larger values are absolute SVG displacement pixels.
const normalizeDepth = (depth) => Math.max(0, depth > 3 ? depth / 60 : depth);
const normalizeCurvature = (curvature) => Math.max(0.1, curvature > 10 ? curvature / 20 : curvature);
const normalizeScale = (scale, targetWidth, targetHeight) => (
  Math.abs(scale) <= 1
    ? scale * Math.min(Math.max(1, targetWidth), Math.max(1, targetHeight))
    : scale
);

export const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

function readOptions(node, options = {}) {
  const dataset = node?.dataset ?? {};
  return {
    ...DEFAULTS,
    lensW: toNumber(dataset.lgWidth, DEFAULTS.lensW),
    lensH: toNumber(dataset.lgHeight, DEFAULTS.lensH),
    borderRadius: toNumber(dataset.lgRadius, DEFAULTS.borderRadius),
    x: toNumber(dataset.lgX, DEFAULTS.x),
    y: toNumber(dataset.lgY, DEFAULTS.y),
    scale: toNumber(dataset.lgScale, DEFAULTS.scale),
    depth: toNumber(dataset.lgDepth, DEFAULTS.depth),
    curvature: toNumber(dataset.lgCurvature, DEFAULTS.curvature),
    splay: toNumber(dataset.lgSplay, DEFAULTS.splay),
    chroma: toNumber(dataset.lgChroma, DEFAULTS.chroma),
    blur: toNumber(dataset.lgBlur, DEFAULTS.blur),
    glow: toNumber(dataset.lgGlow, DEFAULTS.glow),
    edge: toNumber(dataset.lgEdge, DEFAULTS.edge),
    specularAngle: toNumber(dataset.lgSpecularAngle, DEFAULTS.specularAngle),
    followPointer: dataset.lgFollow === 'true',
    fit: dataset.lgFit || DEFAULTS.fit,
    ...options,
  };
}

// feImage samples the map with linear interpolation, so rendering it larger than
// this is wasted work: the SDF field is smooth and upscales without artifacts.
const MAP_MAX_DIM = 160;

export function generateLensMap(options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const width = Math.max(2, Math.round(settings.lensW));
  const height = Math.max(2, Math.round(settings.lensH));
  const radius = clamp(settings.borderRadius, 0, Math.min(width, height) / 2);
  const depth = normalizeDepth(settings.depth);
  const curvature = normalizeCurvature(settings.curvature);
  const splay = Math.max(0, settings.splay);

  const mapScale = Math.min(1, MAP_MAX_DIM / Math.max(width, height));
  const mapW = Math.max(2, Math.round(width * mapScale));
  const mapH = Math.max(2, Math.round(height * mapScale));

  const canvas = document.createElement('canvas');
  canvas.width = mapW;
  canvas.height = mapH;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const image = context.createImageData(mapW, mapH);
  const data = image.data;
  data.fill(128);
  for (let i = 3; i < data.length; i += 4) data[i] = 0;
  const halfW = width / 2;
  const halfH = height / 2;
  const bodyW = halfW - radius;
  const bodyH = halfH - radius;

  const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function roundedRectSdf(px, py) {
    const qx = Math.abs(px) - bodyW;
    const qy = Math.abs(py) - bodyH;
    const outsideX = Math.max(qx, 0);
    const outsideY = Math.max(qy, 0);
    const outside = Math.hypot(outsideX, outsideY);
    const inside = Math.min(Math.max(qx, qy), 0);
    return outside + inside - radius;
  }

  const strength = clamp(depth * splay, 0, 1.25);
  const falloffPower = 0.7 + curvature * 0.05;
  // Keep the anti-aliased mask edge at least one map texel wide after downscaling.
  const maskFeather = Math.max(1.2, 1.2 / mapScale);
  for (let y = 0; y < mapH; y += 1) {
    // Sample positions live in full-resolution lens space; only the grid is scaled.
    const py = (y + 0.5) / mapScale - halfH;
    for (let x = 0; x < mapW; x += 1) {
      const px = (x + 0.5) / mapScale - halfW;
      const sdf = roundedRectSdf(px, py);
      const mask = smoothstep(maskFeather, -maskFeather, sdf);
      const interior = smoothstep(0, -Math.max(2, Math.min(width, height) * 0.16), sdf);
      const edgeBoost = 1 + (1 - interior) * 0.30;
      const edgeDepth = 0.18 + (1 - interior) * 0.82;
      const nx = clamp(px / Math.max(1, halfW - 2), -1, 1);
      const ny = clamp(py / Math.max(1, halfH - 2), -1, 1);
      const shapedX = Math.sign(nx) * Math.pow(Math.abs(nx), falloffPower) * strength * edgeBoost * edgeDepth;
      const shapedY = Math.sign(ny) * Math.pow(Math.abs(ny), falloffPower) * strength * edgeBoost * edgeDepth;

      const red = 128 - shapedX * 92 - shapedY * 14;
      const green = 128 - shapedY * 104;
      const blue = 128 + shapedY * 92 - shapedX * 22;

      const index = (y * mapW + x) * 4;
      data[index] = Math.round(clamp(128 + (red - 128) * mask, 0, 255));
      data[index + 1] = Math.round(clamp(128 + (green - 128) * mask, 0, 255));
      data[index + 2] = Math.round(clamp(128 + (blue - 128) * mask, 0, 255));
      data[index + 3] = Math.round(clamp(255 * mask, 0, 255));
    }
  }

  context.putImageData(image, 0, 0);
  return {
    map: canvas.toDataURL('image/png'),
    width,
    height,
    scale: settings.scale,
    chromaAmount: settings.chroma,
  };
}

function createSvgFilter(id, map, options, geometry) {
  const { rootBounds, targetBounds, targetOffsetLeft, targetOffsetTop } = geometry;
  const effectiveScale = normalizeScale(options.scale, targetBounds.width, targetBounds.height);
  const lensLeft = rootBounds.width * options.x - options.lensW / 2 - targetOffsetLeft;
  const lensTop = rootBounds.height * options.y - options.lensH / 2 - targetOffsetTop;
  const padding = Math.max(options.lensW, options.lensH, Math.abs(effectiveScale) * 2);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('liquid-glass__defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', id);
  filter.setAttribute('x', `${-padding}`);
  filter.setAttribute('y', `${-padding}`);
  filter.setAttribute('width', `${Math.max(1, targetBounds.width + padding * 2)}`);
  filter.setAttribute('height', `${Math.max(1, targetBounds.height + padding * 2)}`);
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('primitiveUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const neutral = document.createElementNS(SVG_NS, 'feFlood');
  neutral.setAttribute('flood-color', 'rgb(128, 128, 128)');
  neutral.setAttribute('flood-opacity', '1');
  neutral.setAttribute('result', 'neutral-map');

  const image = document.createElementNS(SVG_NS, 'feImage');
  image.setAttribute('href', map);
  // Older WebKit only honors the xlink form.
  image.setAttributeNS(XLINK_NS, 'xlink:href', map);
  image.setAttribute('x', `${lensLeft}`);
  image.setAttribute('y', `${lensTop}`);
  image.setAttribute('width', `${options.lensW}`);
  image.setAttribute('height', `${options.lensH}`);
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('result', 'lens-map');

  const fullMap = document.createElementNS(SVG_NS, 'feComposite');
  fullMap.setAttribute('in', 'lens-map');
  fullMap.setAttribute('in2', 'neutral-map');
  fullMap.setAttribute('operator', 'over');
  fullMap.setAttribute('result', 'full-map');

  const lensMask = document.createElementNS(SVG_NS, 'feColorMatrix');
  lensMask.setAttribute('in', 'lens-map');
  lensMask.setAttribute('type', 'matrix');
  lensMask.setAttribute('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0');
  lensMask.setAttribute('result', 'lens-mask');

  const hole = document.createElementNS(SVG_NS, 'feComposite');
  hole.setAttribute('in', 'SourceGraphic');
  hole.setAttribute('in2', 'lens-mask');
  hole.setAttribute('operator', 'out');
  hole.setAttribute('result', 'holed-source');

  const chromaOff = options.chroma * effectiveScale;

  const finishLensComposite = (refractedResult) => {
    const lensOnly = document.createElementNS(SVG_NS, 'feComposite');
    lensOnly.setAttribute('in', refractedResult);
    lensOnly.setAttribute('in2', 'lens-mask');
    lensOnly.setAttribute('operator', 'in');
    lensOnly.setAttribute('result', 'lens-only');

    const composite = document.createElementNS(SVG_NS, 'feComposite');
    composite.setAttribute('in', 'lens-only');
    composite.setAttribute('in2', 'holed-source');
    composite.setAttribute('operator', 'over');
    composite.setAttribute('result', 'glass-result');
    return [lensOnly, composite];
  };

  // Only skip the per-channel (chromatic aberration) path when chroma is effectively off.
  // Any positive chroma -- including the 0.05 default -- runs the triple-displacement blend.
  if (options.chroma <= 0) {
    const disp = document.createElementNS(SVG_NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'full-map');
    disp.setAttribute('scale', `${effectiveScale}`);
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    disp.setAttribute('result', 'refracted');
    filter.append(neutral, image, fullMap, lensMask, hole, disp, ...finishLensComposite('refracted'));
    svg.append(filter);
    return svg;
  }

  // Red channel (stronger displacement)
  const dispR = document.createElementNS(SVG_NS, 'feDisplacementMap');
  dispR.setAttribute('in', 'SourceGraphic');
  dispR.setAttribute('in2', 'full-map');
  dispR.setAttribute('scale', `${effectiveScale + chromaOff}`);
  dispR.setAttribute('xChannelSelector', 'R');
  dispR.setAttribute('yChannelSelector', 'G');
  dispR.setAttribute('result', 'refracted-r');

  const matR = document.createElementNS(SVG_NS, 'feColorMatrix');
  matR.setAttribute('in', 'refracted-r');
  matR.setAttribute('type', 'matrix');
  matR.setAttribute('values', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0');
  matR.setAttribute('result', 'red');

  // Green channel (base displacement)
  const dispG = document.createElementNS(SVG_NS, 'feDisplacementMap');
  dispG.setAttribute('in', 'SourceGraphic');
  dispG.setAttribute('in2', 'full-map');
  dispG.setAttribute('scale', `${effectiveScale}`);
  dispG.setAttribute('xChannelSelector', 'R');
  dispG.setAttribute('yChannelSelector', 'G');
  dispG.setAttribute('result', 'refracted-g');

  const matG = document.createElementNS(SVG_NS, 'feColorMatrix');
  matG.setAttribute('in', 'refracted-g');
  matG.setAttribute('type', 'matrix');
  matG.setAttribute('values', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0');
  matG.setAttribute('result', 'green');

  // Blue channel (weaker displacement)
  const dispB = document.createElementNS(SVG_NS, 'feDisplacementMap');
  dispB.setAttribute('in', 'SourceGraphic');
  dispB.setAttribute('in2', 'full-map');
  dispB.setAttribute('scale', `${effectiveScale - chromaOff}`);
  dispB.setAttribute('xChannelSelector', 'R');
  dispB.setAttribute('yChannelSelector', 'G');
  dispB.setAttribute('result', 'refracted-b');

  const matB = document.createElementNS(SVG_NS, 'feColorMatrix');
  matB.setAttribute('in', 'refracted-b');
  matB.setAttribute('type', 'matrix');
  matB.setAttribute('values', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0');
  matB.setAttribute('result', 'blue');

  // Blend RG
  const blendRG = document.createElementNS(SVG_NS, 'feBlend');
  blendRG.setAttribute('in', 'red');
  blendRG.setAttribute('in2', 'green');
  blendRG.setAttribute('mode', 'screen');
  blendRG.setAttribute('result', 'rg');

  // Blend with B
  const blendRGB = document.createElementNS(SVG_NS, 'feBlend');
  blendRGB.setAttribute('in', 'rg');
  blendRGB.setAttribute('in2', 'blue');
  blendRGB.setAttribute('mode', 'screen');
  blendRGB.setAttribute('result', 'refracted');

  filter.append(
    neutral,
    image,
    fullMap,
    lensMask,
    hole,
    dispR,
    matR,
    dispG,
    matG,
    dispB,
    matB,
    blendRG,
    blendRGB,
    ...finishLensComposite('refracted'),
  );
  svg.append(filter);
  return svg;
}

export class LiquidGlass {
  constructor(root, options = {}) {
    if (!root) throw new Error('LiquidGlass requires a root element.');
    this.root = root;
    this.options = readOptions(root, options);
    this.filterEnabled = options.active !== false;
    this.id = `liquid-glass-${Date.now().toString(36)}-${instanceCount += 1}`;
    this.pointerFrame = null;
    this.init();
  }

  init() {
    this.root.classList.add('liquid-glass');
    this.root.dataset.lgFit = this.options.fit;

    this.originalChildren = Array.from(this.root.childNodes);
    this.content = document.createElement('div');
    this.content.className = 'liquid-glass__content';
    this.originalChildren.forEach((child) => this.content.appendChild(child));
    this.root.appendChild(this.content);

    this.lens = document.createElement('div');
    this.lens.className = 'liquid-glass__lens';
    this.root.appendChild(this.lens);
    this.render();

    this.invalidateGeometry = () => {
      this.geometry = this.getFilterGeometry();
      this.setPosition(this.options.x, this.options.y);
    };
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.invalidateGeometry);
      this.resizeObserver.observe(this.root);
      this.resizeObserver.observe(this.content);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.invalidateGeometry);
    }

    if (this.options.followPointer) {
      this.root.addEventListener('pointermove', this.onPointerMove);
      this.root.addEventListener('pointerleave', this.onPointerLeave);
    }
  }

  onPointerMove = (event) => {
    if (this.pointerFrame) cancelAnimationFrame(this.pointerFrame);
    this.pointerFrame = requestAnimationFrame(() => {
      const rect = this.root.getBoundingClientRect();
      this.setPosition(
        clamp((event.clientX - rect.left) / rect.width, 0, 1),
        clamp((event.clientY - rect.top) / rect.height, 0, 1),
      );
    });
  };

  onPointerLeave = () => this.setPosition(this.options.x, this.options.y);

  enableDrag({ onMove } = {}) {
    let dragging = false;
    const updateFromPointer = (event) => {
      const rect = this.root.getBoundingClientRect();
      const nextX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const nextY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      this.setPosition(nextX, nextY);
      onMove?.(nextX, nextY);
    };

    const onDown = (event) => {
      dragging = true;
      this.root.setPointerCapture?.(event.pointerId);
      this.root.dataset.lgDragging = 'true';
      updateFromPointer(event);
    };
    const onMovePointer = (event) => {
      if (dragging) updateFromPointer(event);
    };
    const stop = (event) => {
      if (!dragging) return;
      dragging = false;
      this.root.releasePointerCapture?.(event.pointerId);
      delete this.root.dataset.lgDragging;
    };

    this.dragListeners = [
      { type: 'pointerdown', handler: onDown },
      { type: 'pointermove', handler: onMovePointer },
      { type: 'pointerup', handler: stop },
      { type: 'pointercancel', handler: stop },
    ];
    this.dragListeners.forEach(({ type, handler }) => this.root.addEventListener(type, handler));
  }

  render() {
    const { map } = generateLensMap(this.options);
    this.lastLensLeft = null;
    this.lastLensTop = null;
    this.geometry = this.getFilterGeometry();
    this.filterId = `${this.id}-${Date.now().toString(36)}`;
    this.defs?.remove();
    this.defs = createSvgFilter(this.filterId, map, this.options, this.geometry);
    this.root.prepend(this.defs);
    this.syncFilter();
    this.syncStyles();
    this.setPosition(this.options.x, this.options.y);
  }

  syncFilter() {
    this.root.style.setProperty('--lg-filter', this.filterEnabled ? `url(#${this.filterId})` : 'none');
  }

  setActive(active) {
    this.filterEnabled = active;
    this.syncFilter();
  }

  setLensOpacity(opacity) {
    this.root.style.setProperty('--lg-opacity', `${clamp(opacity, 0, 1)}`);
  }

  setTransform({ lift = 1, stretchX = 1, stretchY = 1 } = {}) {
    this.root.style.setProperty('--lg-lift', `${lift}`);
    this.root.style.setProperty('--lg-stretch-x', `${stretchX}`);
    this.root.style.setProperty('--lg-stretch-y', `${stretchY}`);
  }

  syncStyles() {
    this.root.style.setProperty('--lg-w', `${this.options.lensW}px`);
    this.root.style.setProperty('--lg-h', `${this.options.lensH}px`);
    this.root.style.setProperty('--lg-radius', `${this.options.borderRadius}px`);
    this.root.style.setProperty('--lg-blur', `${this.options.blur}px`);
    this.root.style.setProperty('--lg-edge', `${this.options.edge}`);
    this.root.style.setProperty('--lg-glow-opacity', `${this.options.glow}`);
    this.root.style.setProperty('--lg-chroma-alpha', `${this.options.chroma}`);
    this.root.style.setProperty('--lg-specular-angle', `${this.options.specularAngle}deg`);
  }

  setPosition(x, y = this.options.y) {
    this.options.x = clamp(x, 0, 1);
    this.options.y = clamp(y, 0, 1);
    this.root.style.setProperty('--lg-x', `${this.options.x * 100}%`);
    this.root.style.setProperty('--lg-y', `${this.options.y * 100}%`);
    const image = this.defs?.querySelector('feImage');
    if (image) {
      const geometry = this.geometry ?? (this.geometry = this.getFilterGeometry());
      const { rootBounds, targetOffsetLeft, targetOffsetTop } = geometry;
      // Sub-tenth-of-a-pixel moves are invisible; skipping them avoids needless
      // attribute churn and filter re-evaluation.
      const lensLeft = Math.round((rootBounds.width * this.options.x - this.options.lensW / 2 - targetOffsetLeft) * 10) / 10;
      const lensTop = Math.round((rootBounds.height * this.options.y - this.options.lensH / 2 - targetOffsetTop) * 10) / 10;
      if (lensLeft === this.lastLensLeft && lensTop === this.lastLensTop) return;
      this.lastLensLeft = lensLeft;
      this.lastLensTop = lensTop;
      image.setAttribute('x', `${lensLeft}`);
      image.setAttribute('y', `${lensTop}`);
    }
  }

  getFilterGeometry() {
    const rootBounds = this.root.getBoundingClientRect();
    const targetBounds = this.content.getBoundingClientRect();
    return {
      rootBounds,
      targetBounds,
      targetOffsetLeft: targetBounds.left - rootBounds.left,
      targetOffsetTop: targetBounds.top - rootBounds.top,
    };
  }

  update(options = {}) {
    const shouldRegenerate = ['lensW', 'lensH', 'borderRadius', 'scale', 'depth', 'curvature', 'splay', 'chroma']
      .some((key) => hasOwn(options, key));
    this.options = { ...this.options, ...options };
    if (shouldRegenerate) this.queueRender();
    else {
      this.syncStyles();
      this.setPosition(this.options.x, this.options.y);
    }
  }

  // Map generation + filter rebuild is the expensive path; coalesce rapid
  // option changes (e.g. dragging a tuning slider) into one render per frame.
  queueRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      if (this.destroyed) return;
      this.render();
    });
  }

  destroy() {
    this.destroyed = true;
    this.root.removeEventListener('pointermove', this.onPointerMove);
    this.root.removeEventListener('pointerleave', this.onPointerLeave);
    this.resizeObserver?.disconnect();
    if (this.invalidateGeometry && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.invalidateGeometry);
    }
    this.dragListeners?.forEach(({ type, handler }) => this.root.removeEventListener(type, handler));
    this.dragListeners = null;
    this.defs?.remove();
    this.lens?.remove();

    if (this.content) {
      const restored = Array.from(this.content.childNodes);
      restored.forEach((child) => this.root.insertBefore(child, this.content));
      this.content.remove();
      this.content = null;
    }

    this.root.classList.remove('liquid-glass');
    delete this.root.dataset.lgFit;
    [
      '--lg-filter', '--lg-x', '--lg-y', '--lg-w', '--lg-h', '--lg-radius',
      '--lg-blur', '--lg-edge', '--lg-glow-opacity', '--lg-chroma-alpha',
      '--lg-specular-angle', '--lg-opacity', '--lg-lift', '--lg-stretch-x', '--lg-stretch-y',
    ].forEach((prop) => this.root.style.removeProperty(prop));
  }
}

export function attachLiquidGlass(selector = '[data-liquid-glass]', options = {}) {
  return Array.from(document.querySelectorAll(selector), (node) => new LiquidGlass(node, options));
}

export class SliderGlass {
  constructor(root, options = {}) {
    this.root = root;
    this.root.classList.add('lg-slider');
    this.root.tabIndex = 0;
    this.root.setAttribute('role', 'slider');
    this.root.setAttribute('aria-valuemin', '0');
    this.root.setAttribute('aria-valuemax', '100');

    this.options = {
      value: 0.62,
      lensW: 44,
      lensH: 22,
      borderRadius: 11,
      scale: 0.082,
      depth: 44,
      curvature: 74,
      chroma: 0.13,
      glow: 0.18,
      edge: 0.36,
      ...options,
    };
    this.position = clamp(this.options.value, 0, 1);
    this.target = this.position;
    this.velocity = 0;
    this.press = 0;
    this.pressVelocity = 0;
    this.targetPress = 0;
    this.dragging = false;
    this.frame = null;

    this.root.replaceChildren();

    const rail = document.createElement('div');
    rail.className = 'lg-slider__rail';
    const track = document.createElement('div');
    track.className = 'lg-slider__track';
    const fill = document.createElement('div');
    fill.className = 'lg-slider__fill';
    const thumb = document.createElement('div');
    thumb.className = 'lg-slider__thumb';
    thumb.setAttribute('aria-hidden', 'true');

    track.appendChild(fill);
    rail.append(track, thumb);
    this.root.appendChild(rail);

    this.rail = rail;
    this.fill = fill;
    this.thumb = thumb;

    this.glass = new LiquidGlass(rail, {
      lensW: this.options.lensW,
      lensH: this.options.lensH,
      borderRadius: this.options.borderRadius,
      x: this.position,
      y: 0.5,
      scale: this.options.scale,
      depth: this.options.depth,
      curvature: this.options.curvature,
      chroma: this.options.chroma,
      glow: this.options.glow,
      edge: this.options.edge,
      fit: 'block',
      active: false,
    });
    this.glass.setLensOpacity(0);

    this.rail.addEventListener('pointerdown', this.onPointerDown);
    this.rail.addEventListener('pointermove', this.onPointerMove);
    this.rail.addEventListener('pointerup', this.onPointerUp);
    this.rail.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('pointerup', this.onPointerUp);
    this.root.addEventListener('keydown', this.onKeyDown);

    // Layout reads are cached and refreshed on resize so the rAF loop never
    // forces a reflow.
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.rail);
      this.resizeObserver.observe(this.thumb);
    }

    this.sync();
    this.start();
  }

  measure() {
    this.thumbW = this.thumb.offsetWidth || this.options.lensW;
    this.railW = this.rail.clientWidth || 1;
  }

  onKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    this.activate();
    if (event.key === 'Home') this.target = 0;
    else if (event.key === 'End') this.target = 1;
    else this.target = clamp(this.target + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -0.04 : 0.04), 0, 1);
    window.clearTimeout(this.keyReleaseTimer);
    this.keyReleaseTimer = window.setTimeout(this.releaseInteraction, 420);
  };

  onPointerDown = (event) => {
    event.preventDefault();
    this.dragging = true;
    this.pointerId = event.pointerId;
    this.rail.setPointerCapture?.(event.pointerId);
    // Measure once per gesture; pointer moves then reuse the cached rect.
    this.dragRect = this.rail.getBoundingClientRect();
    this.activate();
    this.updateFromPointer(event);
  };

  onPointerMove = (event) => {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    this.updateFromPointer(event);
  };

  onPointerUp = (event) => {
    if (!this.dragging) return;
    if (event?.pointerId !== undefined && event.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    this.dragRect = null;
    this.releaseInteraction();
    try {
      this.rail.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  };

  activate() {
    this.root.dataset.sliderActive = 'true';
    this.glass.setActive(true);
    this.targetPress = 1;
    this.start();
  }

  releaseInteraction = () => {
    this.targetPress = 0;
    delete this.root.dataset.sliderActive;
    this.start();
  };

  updateFromPointer(event) {
    const rect = this.dragRect ?? this.rail.getBoundingClientRect();
    const available = Math.max(1, rect.width - this.thumbW);
    this.target = clamp((event.clientX - rect.left - this.thumbW / 2) / available, 0, 1);
  }

  start() {
    if (this.frame) return;
    const tick = () => {
      if (prefersReducedMotion()) {
        this.position = this.target;
        this.velocity = 0;
        this.press = this.targetPress;
        this.pressVelocity = 0;
      } else {
        const stiffness = this.dragging ? 0.30 : 0.18;
        const damping = this.dragging ? 0.68 : 0.70;
        this.velocity += (this.target - this.position) * stiffness;
        this.velocity *= damping;
        this.position = clamp(this.position + this.velocity, 0, 1);

        this.pressVelocity += (this.targetPress - this.press) * 0.15;
        this.pressVelocity *= 0.70;
        this.press = clamp(this.press + this.pressVelocity, 0, 1.08);
      }

      this.sync();
      if (!this.dragging && this.targetPress === 0 && this.press < 0.015) {
        this.press = 0;
        this.glass.setLensOpacity(0);
        this.glass.setActive(false);
        this.sync();
      }
      const settled = !this.dragging
        && this.targetPress === 0
        && this.press < 0.015
        && Math.abs(this.velocity) < 0.0005
        && Math.abs(this.target - this.position) < 0.0005;
      if (settled) {
        this.frame = null;
        return;
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  sync() {
    const thumbW = this.thumbW;
    const railW = this.railW;
    const available = Math.max(1, railW - thumbW);
    const thumbX = this.position * available;
    const centerX = thumbX + thumbW / 2;
    const speed = Math.min(1, Math.abs(this.velocity) * 15);
    const stretchX = 1 + this.press * 0.07 + speed * 0.20;
    const stretchY = 1 + this.press * 0.045 - speed * 0.10;
    const lift = 1 + this.press * 0.15 + speed * 0.05;

    this.fill.style.width = `${centerX}px`;
    this.thumb.style.transform = `translate3d(${thumbX}px, -50%, 0) scale(${stretchX}, ${stretchY})`;
    this.thumb.style.opacity = `${clamp(1 - this.press, 0, 1)}`;
    this.rail.style.setProperty('--slider-glass', `${clamp(this.press, 0, 1)}`);
    this.glass.setLensOpacity(clamp(this.press, 0, 1));
    this.glass.setTransform({ lift, stretchX, stretchY });
    this.glass.setPosition(centerX / railW, 0.5);
    this.root.setAttribute('aria-valuenow', `${Math.round(this.position * 100)}`);
  }

  destroy() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.rail.removeEventListener('pointerdown', this.onPointerDown);
    this.rail.removeEventListener('pointermove', this.onPointerMove);
    this.rail.removeEventListener('pointerup', this.onPointerUp);
    this.rail.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.root.removeEventListener('keydown', this.onKeyDown);
    this.glass.destroy();
  }
}

export class SwitchGlass {
  constructor(track, options = {}) {
    this.track = track;
    this.track.classList.add('lg-switch');
    this.track.tabIndex = 0;
    this.track.setAttribute('role', 'switch');
    if (!this.track.getAttribute('aria-label')) {
      this.track.setAttribute('aria-label', options.label || 'Glass switch');
    }
    this.position = 0;
    this.target = 0;
    this.velocity = 0;
    this.press = 0;
    this.pressVelocity = 0;
    this.targetPress = 0;
    this.journeyStart = 0;
    this.journeyTotal = 0;
    this.dragging = false;
    this.frame = null;

    const rail = document.createElement('div');
    rail.className = 'lg-switch__rail';
    this.track.appendChild(rail);
    this.rail = rail;

    const fill = document.createElement('div');
    fill.className = 'lg-switch__fill';
    rail.appendChild(fill);

    const thumb = document.createElement('div');
    thumb.className = 'lg-switch__thumb';
    rail.appendChild(thumb);

    this.fill = fill;
    this.thumb = thumb;
    this.native = document.createElement('input');
    this.native.type = 'checkbox';
    this.native.className = 'lg-switch__native';
    this.native.tabIndex = -1;
    this.native.setAttribute('aria-hidden', 'true');
    this.track.appendChild(this.native);

    this.glass = new LiquidGlass(rail, {
      lensW: 44,
      lensH: 22,
      borderRadius: 11,
      x: 0.28,
      y: 0.5,
      scale: 0.13,
      depth: 58,
      curvature: 78,
      splay: 1,
      chroma: 0.12,
      glow: 0.16,
      edge: 0.34,
      blur: 0,
      fit: 'inline',
      active: false,
      ...options,
    });
    this.glass.setLensOpacity(0);

    this.track.addEventListener('pointerdown', this.onPointerDown);
    this.track.addEventListener('pointermove', this.onPointerMove);
    this.track.addEventListener('pointerup', this.onPointerUp);
    this.track.addEventListener('pointercancel', this.onPointerUp);
    this.track.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('pointerup', this.onPointerUp);

    // Cache layout reads so the rAF loop never forces a reflow.
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(this.rail);
      this.resizeObserver.observe(this.thumb);
    }

    this.setOn(this.native.checked, { animate: false });
    this.start();
  }

  measure() {
    this.thumbW = this.thumb.offsetWidth || 44;
    this.railW = this.rail.clientWidth || 1;
  }

  onKeyDown = (event) => {
    if (![' ', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') this.setOn(false);
    else if (event.key === 'ArrowRight') this.setOn(true);
    else this.setOn(!this.native.checked);
  };

  onPointerDown = (event) => {
    event.preventDefault();
    this.track.setPointerCapture?.(event.pointerId);
    this.dragging = true;
    this.pointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.hasDragged = false;
    this.startChecked = this.native.checked;
    this.track.dataset.switchDragging = 'true';
    // Measure once per gesture; pointer moves then reuse the cached rect.
    this.dragRect = this.rail.getBoundingClientRect();
    this.activate();
  };

  updateFromPointer(event) {
    const rect = this.dragRect ?? this.rail.getBoundingClientRect();
    const available = Math.max(1, rect.width - this.thumbW);
    this.target = clamp((event.clientX - rect.left - this.thumbW / 2) / available, 0, 1);
    this.native.checked = this.target >= 0.5;
    this.track.setAttribute('aria-checked', this.native.checked ? 'true' : 'false');
  }

  onPointerMove = (event) => {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    if (Math.abs(event.clientX - this.dragStartX) > 4) this.hasDragged = true;
    if (this.hasDragged) this.updateFromPointer(event);
  };

  onPointerUp = (event) => {
    if (!this.dragging) return;
    if (event?.pointerId !== undefined && event.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    this.targetPress = 0;
    this.dragRect = null;
    delete this.track.dataset.switchDragging;
    if (!this.hasDragged) {
      this.setOn(!this.startChecked);
    } else {
      this.setOn(this.native.checked);
    }
    try {
      this.track.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  };

  activate() {
    this.glass.setActive(true);
    // Record the journey so the press arc peaks mid-travel. The arc starts at
    // the phase matching the current press level, so it continues seamlessly
    // whether the press is at rest (full arc) or already raised (drag release:
    // mostly descent), with no dip or jump at the handoff.
    this.journeyStart = this.position;
    this.journeyTotal = Math.abs(this.target - this.journeyStart);
    this.journeyPhase = Math.asin(clamp(this.press, 0, 1));
    this.start();
  }

  // Press target from travel progress: sweeps the sine arc from the recorded
  // starting phase to PI, so it rises, peaks, and is exactly 0 at landing.
  getTravelPress() {
    if (this.journeyTotal < 0.001) return 0;
    const remaining = Math.abs(this.target - this.position);
    const p = clamp(1 - remaining / this.journeyTotal, 0, 1);
    const phase = this.journeyPhase ?? 0;
    return Math.sin(phase + (Math.PI - phase) * p);
  }

  setOn(on, { animate = true } = {}) {
    const checked = Boolean(on);
    this.native.checked = checked;
    this.track.setAttribute('aria-checked', checked ? 'true' : 'false');
    this.target = checked ? 1 : 0;
    if (animate) {
      this.activate();
    } else {
      this.position = this.target;
      this.velocity = 0;
      this.press = 0;
      this.targetPress = 0;
      this.journeyTotal = 0;
      this.glass.setActive(false);
      this.glass.setLensOpacity(0);
      this.sync();
    }
  }

  start() {
    if (this.frame) return;
    const tick = () => {
      const reduce = prefersReducedMotion();
      if (reduce) {
        this.position = this.target;
        this.velocity = 0;
      } else {
        const stiffness = this.dragging ? 0.28 : 0.18;
        const damping = this.dragging ? 0.68 : 0.67;
        this.velocity += (this.target - this.position) * stiffness;
        this.velocity *= damping;
        this.position = clamp(this.position + this.velocity, 0, 1);
      }

      // Held at 1 while dragging; otherwise follow the travel arc so the
      // white pill fades out on the way up and back in exactly as it lands.
      this.targetPress = this.dragging ? 1 : this.getTravelPress();

      const settled = !this.dragging && Math.abs(this.target - this.position) < 0.002 && Math.abs(this.velocity) < 0.002;
      if (reduce) {
        this.press = 0;
        this.targetPress = 0;
        this.pressVelocity = 0;
        this.journeyTotal = 0;
      } else {
        this.pressVelocity += (this.targetPress - this.press) * 0.30;
        this.pressVelocity *= 0.58;
        this.press = clamp(this.press + this.pressVelocity, 0, 1);
      }

      this.sync();
      const fullyIdle = settled
        && this.targetPress < 0.01
        && this.press < 0.015;
      if (fullyIdle) {
        this.press = 0;
        this.pressVelocity = 0;
        this.journeyTotal = 0;
        this.glass.setLensOpacity(0);
        this.glass.setActive(false);
        this.sync();
        this.frame = null;
        return;
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  sync() {
    const thumbW = this.thumbW;
    const railW = this.railW;
    const available = Math.max(1, railW - thumbW);
    const thumbX = this.position * available;
    const centerX = thumbX + thumbW / 2;
    const speed = Math.min(1, Math.abs(this.velocity) * 8);
    const press = this.press;
    const stretchX = 1 + press * 0.10 + speed * 0.15;
    const stretchY = 1 + press * 0.07 - speed * 0.08;
    const lift = 1 + press * 0.22 + speed * 0.05;

    this.rail.style.setProperty('--switch-progress', `${this.position}`);
    this.fill.style.opacity = `${this.position}`;
    this.thumb.style.transform = `translate3d(${thumbX}px, -50%, 0) scale(${stretchX}, ${stretchY})`;
    this.thumb.style.opacity = `${clamp(1 - press, 0, 1)}`;
    this.glass.setLensOpacity(clamp(press * 0.86, 0, 0.86));
    this.glass.setTransform({ lift, stretchX, stretchY });
    this.glass.setPosition(centerX / railW, 0.5);
  }

  destroy() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.track.removeEventListener('pointerdown', this.onPointerDown);
    this.track.removeEventListener('pointermove', this.onPointerMove);
    this.track.removeEventListener('pointerup', this.onPointerUp);
    this.track.removeEventListener('pointercancel', this.onPointerUp);
    this.track.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.glass.destroy();
    this.native.remove();
    this.thumb.remove();
    this.fill.remove();
    this.rail.remove();
  }
}

export class ToggleGroupGlass {
  constructor(group, options = {}) {
    this.group = group;
    this.group.classList.add('lg-toggle-group');
    this.buttons = Array.from(this.group.querySelectorAll('[data-toggle-option]'));

    const highlight = document.createElement('div');
    highlight.className = 'lg-toggle-group__highlight';
    this.group.appendChild(highlight);

    this.highlight = highlight;
    this.spring = { x: 0, v: 0 };
    this.targetX = 0;
    this.currentIndex = 0;
    this.dragging = false;
    this.pointerId = null;
    this.press = 0;
    this.pressVelocity = 0;
    this.targetPress = 0;
    this.journeyStart = 0;
    this.journeyTotal = 0;
    this.running = false;

    this.glass = new LiquidGlass(group, {
      lensW: 112,
      lensH: 56,
      borderRadius: 999,
      scale: 0.11,
      depth: 62,
      curvature: 82,
      chroma: 0.10,
      glow: 0.14,
      edge: 0.22,
      fit: 'block',
      ...options,
    });
    this.glass.setLensOpacity(0);

    this.buttons.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        if (!this.dragging) this.select(i, { pulse: true });
      });
    });
    this.group.addEventListener('pointerdown', this.onPointerDown);
    this.group.addEventListener('pointermove', this.onPointerMove);
    this.group.addEventListener('pointerup', this.onPointerUp);
    this.group.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('pointerup', this.onPointerUp);

    // Cache layout reads so the rAF loop never forces a reflow.
    this.groupW = 1;
    this.highlightW = 0;
    this.measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.measure();
        this.updateHighlightWidth();
      });
      this.resizeObserver.observe(this.group);
    }

    this.select(0, { pulse: false });
  }

  measure() {
    this.groupW = this.group.getBoundingClientRect().width || 1;
  }

  select(index, { pulse = false } = {}) {
    this.currentIndex = clamp(index, 0, this.buttons.length - 1);
    this.buttons.forEach((btn, i) => btn.classList.toggle('active', i === index));
    const metrics = this.getMetrics();
    this.targetX = metrics.centers[this.currentIndex] ?? 0.5;
    this.updateHighlightWidth(this.currentIndex);
    if (pulse) {
      // Record the journey so the press arc peaks mid-travel. The arc starts at
      // the phase matching the current press level, so it continues seamlessly
      // whether the press is at rest (full arc) or already raised (drag release:
      // mostly descent), with no dip or jump at the handoff.
      this.journeyStart = this.spring.x;
      this.journeyTotal = Math.abs(this.targetX - this.journeyStart);
      this.journeyPhase = Math.asin(clamp(this.press, 0, 1));
      this.glass.setActive(true);
    }
    if (!this.running) {
      this.running = true;
      this.animate();
    }
  }

  // Press target from travel progress: sweeps the sine arc from the recorded
  // starting phase to PI, so it rises, peaks, and is exactly 0 at landing.
  getTravelPress() {
    if (this.journeyTotal < 0.001) return 0;
    const remaining = Math.abs(this.targetX - this.spring.x);
    const p = clamp(1 - remaining / this.journeyTotal, 0, 1);
    const phase = this.journeyPhase ?? 0;
    return Math.sin(phase + (Math.PI - phase) * p);
  }

  getMetrics() {
    const rect = this.group.getBoundingClientRect();
    const centers = this.buttons.map((btn) => {
      const btnRect = btn.getBoundingClientRect();
      return (btnRect.left + btnRect.width / 2 - rect.left) / rect.width;
    });
    return { rect, centers };
  }

  updateHighlightWidth(index = this.currentIndex) {
    const btnRect = this.buttons[index]?.getBoundingClientRect();
    if (!btnRect || !btnRect.width) return;
    this.highlightW = btnRect.width;
    this.group.style.setProperty('--toggle-highlight-w', `${btnRect.width}px`);
    this.syncLensSize(btnRect);
  }

  // Keep the glass lens the same size as the active segment so it never bulges
  // outside the control or overlaps neighboring options. Regenerating the
  // displacement map is expensive, so only update when the size actually changes.
  syncLensSize(btnRect) {
    const lensW = Math.round(btnRect.width);
    const lensH = Math.round(btnRect.height);
    if (lensW < 2 || lensH < 2) return;
    if (lensW === this.lensW && lensH === this.lensH) return;
    this.lensW = lensW;
    this.lensH = lensH;
    this.glass.update({ lensW, lensH, borderRadius: lensH / 2 });
  }

  nearestIndex(x) {
    const { centers } = this.getMetrics();
    let bestIndex = 0;
    let bestDistance = Infinity;
    centers.forEach((center, index) => {
      const distance = Math.abs(center - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  onPointerDown = (event) => {
    event.preventDefault();
    this.dragging = true;
    this.pointerId = event.pointerId;
    this.group.dataset.toggleDragging = 'true';
    this.group.setPointerCapture?.(event.pointerId);
    this.targetPress = 1;
    this.glass.setActive(true);
    this.updateFromPointer(event);
    if (!this.running) {
      this.running = true;
      this.animate();
    }
  };

  onPointerMove = (event) => {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    this.updateFromPointer(event);
  };

  onPointerUp = (event) => {
    if (!this.dragging) return;
    if (event?.pointerId !== undefined && event.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    delete this.group.dataset.toggleDragging;
    this.targetPress = 0;
    this.select(this.nearestIndex(this.targetX), { pulse: true });
    try {
      this.group.releasePointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  };

  updateFromPointer(event) {
    const { rect } = this.getMetrics();
    this.targetX = clamp((event.clientX - rect.left) / rect.width, 0.08, 0.92);
    const index = this.nearestIndex(this.targetX);
    this.currentIndex = index;
    this.buttons.forEach((btn, i) => btn.classList.toggle('active', i === index));
    this.updateHighlightWidth(index);
  }

  animate = () => {
    // While dragging the press is held at 1; otherwise it follows the travel arc,
    // so a drag release hands off into the descending half of the arc seamlessly.
    if (!this.dragging) this.targetPress = this.getTravelPress();

    if (prefersReducedMotion()) {
      this.spring.x = this.targetX;
      this.spring.v = 0;
      this.press = 0;
      this.targetPress = 0;
      this.pressVelocity = 0;
      this.journeyTotal = 0;
    } else {
      const k = this.dragging ? 0.22 : 0.10;
      const d = this.dragging ? 0.68 : 0.72;
      this.spring.v += (this.targetX - this.spring.x) * k;
      this.spring.v *= d;
      this.spring.x += this.spring.v;
      this.pressVelocity += (this.targetPress - this.press) * 0.30;
      this.pressVelocity *= 0.58;
      this.press = clamp(this.press + this.pressVelocity, 0, 1);
    }
    // Kept subtle so the lens never bulges outside the control at peak press.
    const press = this.press;
    const scaleX = 1 + press * 0.06;
    const scaleY = 1 + press * 0.045;
    const lift = 1 + press * 0.04;
    const glassOpacity = clamp(press * 0.62, 0, 0.62);
    const whiteOpacity = clamp(0.88 - press * 0.88, 0, 0.88);
    const rimOpacity = clamp(press * 0.35, 0, 0.35);
    const shadowOpacity = clamp(0.08 + press * 0.20, 0.08, 0.28);
    const left = this.spring.x * this.groupW - this.highlightW / 2;
    this.group.style.setProperty('--toggle-highlight-x', `${left}px`);
    this.group.style.setProperty('--toggle-scale', `${scaleX}`);
    this.group.style.setProperty('--toggle-white-opacity', `${whiteOpacity}`);
    this.group.style.setProperty('--toggle-rim-opacity', `${rimOpacity}`);
    this.group.style.setProperty('--toggle-shadow-opacity', `${shadowOpacity}`);
    this.glass.setPosition(this.spring.x, 0.5);
    this.glass.setLensOpacity(glassOpacity);
    this.glass.setTransform({ lift, stretchX: scaleX, stretchY: scaleY });

    const settled = !this.dragging
      && Math.abs(this.spring.v) <= 0.0005
      && Math.abs(this.targetX - this.spring.x) <= 0.0005
      && this.press <= 0.01
      && this.targetPress <= 0.01;
    if (!settled) {
      requestAnimationFrame(this.animate);
    } else {
      // Press is already ~0 here by construction; these final writes are
      // sub-perceptual corrections, not a visible snap.
      this.running = false;
      this.press = 0;
      this.pressVelocity = 0;
      this.journeyTotal = 0;
      this.group.style.setProperty('--toggle-scale', '1');
      this.group.style.setProperty('--toggle-white-opacity', '0.88');
      this.group.style.setProperty('--toggle-rim-opacity', '0');
      this.group.style.setProperty('--toggle-shadow-opacity', '0.08');
      this.glass.setPosition(this.targetX, 0.5);
      this.glass.setLensOpacity(0);
      this.glass.setActive(false);
      this.glass.setTransform({ lift: 1, stretchX: 1, stretchY: 1 });
    }
  };

  destroy() {
    this.resizeObserver?.disconnect();
    this.group.removeEventListener('pointerdown', this.onPointerDown);
    this.group.removeEventListener('pointermove', this.onPointerMove);
    this.group.removeEventListener('pointerup', this.onPointerUp);
    this.group.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.glass.destroy();
    this.highlight.remove();
  }
}

if (typeof window !== 'undefined') {
  window.LiquidGlass = LiquidGlass;
  window.attachLiquidGlass = attachLiquidGlass;
  window.generateLensMap = generateLensMap;
  window.SliderGlass = SliderGlass;
  window.SwitchGlass = SwitchGlass;
  window.ToggleGroupGlass = ToggleGroupGlass;
}

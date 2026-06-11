const SVG_NS = 'http://www.w3.org/2000/svg';
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
  refractionTarget: null,
};

let instanceCount = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

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

export function generateLensMap(options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const width = Math.max(2, Math.round(settings.lensW));
  const height = Math.max(2, Math.round(settings.lensH));
  const radius = clamp(settings.borderRadius, 0, Math.min(width, height) / 2);
  const depth = Math.max(0, settings.depth > 3 ? settings.depth / 60 : settings.depth);
  const curvature = Math.max(0.1, settings.curvature > 10 ? settings.curvature / 20 : settings.curvature);
  const splay = Math.max(0, settings.splay);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const image = context.createImageData(width, height);
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

  function writePixel(px, py, r, g, b, a = 255) {
    if (px < 0 || px >= width || py < 0 || py >= height) return;
    const index = (py * width + px) * 4;
    data[index] = Math.round(clamp(r, 0, 255));
    data[index + 1] = Math.round(clamp(g, 0, 255));
    data[index + 2] = Math.round(clamp(b, 0, 255));
    data[index + 3] = Math.round(clamp(a, 0, 255));
  }

  const strength = clamp(depth * splay, 0, 1.25);
  const falloffPower = 0.7 + curvature * 0.05;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x + 0.5 - halfW;
      const py = y + 0.5 - halfH;
      const sdf = roundedRectSdf(px, py);
      const mask = smoothstep(1.2, -1.2, sdf);
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

      writePixel(
        x,
        y,
        128 + (red - 128) * mask,
        128 + (green - 128) * mask,
        128 + (blue - 128) * mask,
        255 * mask,
      );
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
  const effectiveScale = Math.abs(options.scale) <= 1
    ? options.scale * Math.min(Math.max(1, targetBounds.width), Math.max(1, targetBounds.height))
    : options.scale;
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

  if (options.chroma <= 0.05) {
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

    const originalChildren = Array.from(this.root.childNodes);
    this.content = document.createElement('div');
    this.content.className = 'liquid-glass__content';
    originalChildren.forEach((child) => this.content.appendChild(child));
    this.root.appendChild(this.content);

    this.lens = document.createElement('div');
    this.lens.className = 'liquid-glass__lens';
    this.root.appendChild(this.lens);
    this.render();

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

    this.root.addEventListener('pointerdown', (event) => {
      dragging = true;
      this.root.setPointerCapture?.(event.pointerId);
      this.root.dataset.lgDragging = 'true';
      updateFromPointer(event);
    });
    this.root.addEventListener('pointermove', (event) => {
      if (dragging) updateFromPointer(event);
    });
    const stop = (event) => {
      if (!dragging) return;
      dragging = false;
      this.root.releasePointerCapture?.(event.pointerId);
      delete this.root.dataset.lgDragging;
    };
    this.root.addEventListener('pointerup', stop);
    this.root.addEventListener('pointercancel', stop);
  }

  render() {
    const { map } = generateLensMap(this.options);
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
      const { rootBounds, targetOffsetLeft, targetOffsetTop } = this.getFilterGeometry();
      const lensLeft = rootBounds.width * this.options.x - this.options.lensW / 2 - targetOffsetLeft;
      const lensTop = rootBounds.height * this.options.y - this.options.lensH / 2 - targetOffsetTop;
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
    if (shouldRegenerate) this.render();
    else {
      this.syncStyles();
      this.setPosition(this.options.x, this.options.y);
    }
  }

  destroy() {
    this.root.removeEventListener('pointermove', this.onPointerMove);
    this.root.removeEventListener('pointerleave', this.onPointerLeave);
    this.defs?.remove();
    this.lens?.remove();
    this.root.style.removeProperty('--lg-filter');
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
    this.visualPress = 0;
    this.pulseStart = 0;
    this.pulseDuration = 650;
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

    this.sync();
    this.start();
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
  }

  releaseInteraction = () => {
    this.targetPress = 0;
    this.pressVelocity += 0.12;
    delete this.root.dataset.sliderActive;
  };

  updateFromPointer(event) {
    const rect = this.rail.getBoundingClientRect();
    const thumbW = this.thumb.offsetWidth || this.options.lensW;
    const available = Math.max(1, rect.width - thumbW);
    this.target = clamp((event.clientX - rect.left - thumbW / 2) / available, 0, 1);
  }

  start() {
    if (this.frame) return;
    const tick = () => {
      const stiffness = this.dragging ? 0.30 : 0.18;
      const damping = this.dragging ? 0.68 : 0.70;
      this.velocity += (this.target - this.position) * stiffness;
      this.velocity *= damping;
      this.position = clamp(this.position + this.velocity, 0, 1);

      this.pressVelocity += (this.targetPress - this.press) * 0.15;
      this.pressVelocity *= 0.70;
      this.press = clamp(this.press + this.pressVelocity, 0, 1.08);

      this.sync();
      if (!this.dragging && this.targetPress === 0 && this.press < 0.015) {
        this.press = 0;
        this.glass.setLensOpacity(0);
        this.glass.setActive(false);
        this.sync();
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  sync() {
    const thumbW = this.thumb.offsetWidth || this.options.lensW;
    const railW = this.rail.clientWidth || 1;
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
    this.visualPress = 0;
    this.pulseStart = 0;
    this.pulseDuration = 650;
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
    this.setOn(this.native.checked, { animate: false });
    this.start();
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
    this.activate();
  };

  updateFromPointer(event) {
    const rect = this.rail.getBoundingClientRect();
    const thumbW = this.thumb.offsetWidth || 44;
    const available = Math.max(1, rect.width - thumbW);
    this.target = clamp((event.clientX - rect.left - thumbW / 2) / available, 0, 1);
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
    this.targetPress = this.dragging ? 1 : 0;
    this.startPulse();
  }

  startPulse() {
    this.pulseStart = (globalThis.performance?.now?.() ?? Date.now());
  }

  getPulsePress() {
    if (!this.pulseStart) return 0;
    const now = globalThis.performance?.now?.() ?? Date.now();
    const progress = (now - this.pulseStart) / this.pulseDuration;
    if (progress >= 1) {
      this.pulseStart = 0;
      return 0;
    }
    return Math.sin(progress * Math.PI);
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
      this.visualPress = 0;
      this.pulseStart = 0;
      this.targetPress = 0;
      this.glass.setActive(false);
      this.glass.setLensOpacity(0);
      this.sync();
    }
  }

  start() {
    if (this.frame) return;
    const tick = () => {
      const stiffness = this.dragging ? 0.28 : 0.18;
      const damping = this.dragging ? 0.68 : 0.67;
      this.velocity += (this.target - this.position) * stiffness;
      this.velocity *= damping;
      this.position = clamp(this.position + this.velocity, 0, 1);

      const settled = !this.dragging && Math.abs(this.target - this.position) < 0.002 && Math.abs(this.velocity) < 0.002;
      if (settled && this.targetPress > 0) this.targetPress = 0;
      this.pressVelocity += (this.targetPress - this.press) * 0.14;
      this.pressVelocity *= 0.72;
      this.press = clamp(this.press + this.pressVelocity, 0, 1.08);
      this.visualPress = Math.max(this.press, this.getPulsePress());

      this.sync();
      if (settled && this.targetPress === 0 && this.press < 0.015 && !this.pulseStart) {
        this.press = 0;
        this.visualPress = 0;
        this.glass.setLensOpacity(0);
        this.glass.setActive(false);
        this.sync();
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  sync() {
    const thumbW = this.thumb.offsetWidth || 44;
    const railW = this.rail.clientWidth || 1;
    const available = Math.max(1, railW - thumbW);
    const thumbX = this.position * available;
    const centerX = thumbX + thumbW / 2;
    const speed = Math.min(1, Math.abs(this.velocity) * 8);
    const press = this.visualPress ?? this.press;
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

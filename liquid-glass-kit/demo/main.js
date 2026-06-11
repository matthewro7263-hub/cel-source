import '../src/liquid-glass.css';
import { LiquidGlass, attachLiquidGlass, SliderGlass, SwitchGlass, ToggleGroupGlass, generateLensMap, prefersReducedMotion } from '../src/liquid-glass.js';
import { initRefraction } from '../src/liquid-glass-webgl.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Playground lens
const glasses = attachLiquidGlass('[data-liquid-glass]');
const mapResult = glasses.find((glass) => glass.root.id === 'map-result');
const mapPreview = document.querySelector('#map-preview');

const mapSettings = {
  lensW: 180,
  lensH: 90,
  borderRadius: 45,
  scale: 0.122,
  depth: 60,
  curvature: 80,
  splay: 1,
  chroma: 0.2,
  blur: 0,
  glow: 0.1,
  edge: 0.25,
  specularAngle: 45,
};

let mapPreviewQueued = false;
function syncMapPreview() {
  if (!mapPreview || mapPreviewQueued) return;
  // Coalesce rapid slider input into one regeneration per frame.
  mapPreviewQueued = true;
  requestAnimationFrame(() => {
    mapPreviewQueued = false;
    const { map } = generateLensMap(mapSettings);
    mapPreview.src = map;
  });
}

function paintRange(rangeInput) {
  const min = Number(rangeInput.min || 0);
  const max = Number(rangeInput.max || 100);
  const value = Number(rangeInput.value || 0);
  const percent = ((value - min) / (max - min)) * 100;
  rangeInput.style.background = `linear-gradient(90deg, #9287f3 0 ${percent}%, #f0eef4 ${percent}% 100%)`;
}

const controls = document.querySelectorAll('[data-control]');
controls.forEach((control) => {
  const target = document.querySelector(`#${control.dataset.control}`);
  const output = document.querySelector(`[data-output="${control.dataset.control}"]`);
  target.value = target.defaultValue;
  const apply = () => {
    const value = Number(target.value);
    const decimals = Number(target.dataset.decimals ?? 0);
    output.textContent = value.toFixed(decimals);
    mapSettings[control.dataset.option] = value;
    mapResult?.update({ [control.dataset.option]: value });
    syncMapPreview();
    paintRange(target);
  };
  target.addEventListener('input', apply);
  apply();
});
syncMapPreview();

mapResult?.enableDrag();

// Slider
const sliderShell = document.querySelector('#range-demo');
if (sliderShell) new SliderGlass(sliderShell);

// Switch
const switchContainer = document.querySelector('#switch-demo');
if (switchContainer) new SwitchGlass(switchContainer);

class ElasticGlassButton {
  constructor(button) {
    this.button = button;
    this.pointerId = null;
    this.pressed = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.press = 0;
    this.pressVelocity = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.targetPress = 0;
    this.glowX = 50;
    this.glowY = 50;
    this.targetGlowX = 50;
    this.targetGlowY = 50;
    this.raf = null;

    const refract = document.createElement('span');
    refract.className = 'elastic-glass-button__refract';
    refract.setAttribute('aria-hidden', 'true');
    const refractSource = document.createElement('span');
    refractSource.className = 'elastic-glass-button__refract-source';
    refract.appendChild(refractSource);
    this.button.prepend(refract);

    const glow = document.createElement('span');
    glow.className = 'elastic-glass-button__glow';
    glow.setAttribute('aria-hidden', 'true');
    this.button.insertBefore(glow, refract.nextSibling);
    this.glow = glow;
    this.glass = new LiquidGlass(refract, {
      lensW: 82,
      lensH: 82,
      borderRadius: 41,
      x: 0.5,
      y: 0.5,
      scale: 0.16,
      depth: 68,
      curvature: 84,
      splay: 1,
      chroma: 0.13,
      glow: 0.26,
      edge: 0.42,
      blur: 0,
      fit: 'block',
    });
    this.glass.setLensOpacity(0.50);

    this.button.addEventListener('pointerdown', this.onPointerDown);
    this.button.addEventListener('pointermove', this.onPointerMove);
    this.button.addEventListener('pointerup', this.onPointerUp);
    this.button.addEventListener('pointercancel', this.onPointerUp);
    this.button.addEventListener('lostpointercapture', this.onPointerUp);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('mouseup', this.release);
    window.addEventListener('blur', this.release);
    this.start();
  }

  onPointerDown = (event) => {
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.pressed = true;
    this.targetPress = 1;
    this.button.classList.add('is-pressing');
    this.button.setPointerCapture?.(event.pointerId);
    this.updateTarget(event);
    this.start();
  };

  onPointerMove = (event) => {
    if (!this.pressed || event.pointerId !== this.pointerId) return;
    this.updateTarget(event);
  };

  onPointerUp = (event) => {
    if (this.pointerId !== null && event?.pointerId !== undefined && this.pointerId !== event.pointerId) return;
    this.release();
  };

  release = () => {
    const pointerId = this.pointerId;
    const shouldPop = this.pressed || this.targetPress > 0.1;
    this.pressed = false;
    this.pointerId = null;
    this.targetX = 0;
    this.targetY = 0;
    this.targetGlowX = 50;
    this.targetGlowY = 50;
    this.targetPress = 0;
    if (shouldPop) this.pressVelocity += 0.26;
    this.button.classList.remove('is-pressing');
    if (pointerId !== null) {
      try {
        this.button.releasePointerCapture?.(pointerId);
      } catch {
        // Pointer capture may already be released by the browser or automation layer.
      }
    }
    this.start();
  };

  updateTarget(event) {
    const rect = this.button.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const dx = localX - rect.width / 2;
    const dy = localY - rect.height / 2;
    const maxPull = Math.min(rect.width, rect.height) * 0.34;
    const distance = Math.hypot(dx, dy);
    const easedDistance = maxPull * Math.tanh(distance / (maxPull * 1.65));
    const unitX = distance > 0.001 ? dx / distance : 0;
    const unitY = distance > 0.001 ? dy / distance : 0;
    const resistedX = unitX * easedDistance;
    const resistedY = unitY * easedDistance;

    this.targetX = resistedX * 0.86;
    this.targetY = resistedY * 0.86;
    this.targetGlowX = clamp(((rect.width / 2 + resistedX * 0.66) / rect.width) * 100, 18, 82);
    this.targetGlowY = clamp(((rect.height / 2 + resistedY * 0.66) / rect.height) * 100, 18, 82);
  }

  start() {
    if (this.raf) return;
    const tick = () => {
      if (prefersReducedMotion()) {
        this.x = this.targetX;
        this.y = this.targetY;
        this.vx = 0;
        this.vy = 0;
        this.glowX = this.targetGlowX;
        this.glowY = this.targetGlowY;
        this.press = this.targetPress;
        this.pressVelocity = 0;
      } else {
        const stiffness = this.pressed ? 0.13 : 0.11;
        const damping = this.pressed ? 0.76 : 0.70;
        this.vx += (this.targetX - this.x) * stiffness;
        this.vy += (this.targetY - this.y) * stiffness;
        this.vx *= damping;
        this.vy *= damping;
        this.x += this.vx;
        this.y += this.vy;
        this.glowX += (this.targetGlowX - this.glowX) * 0.12;
        this.glowY += (this.targetGlowY - this.glowY) * 0.12;

        this.pressVelocity += (this.targetPress - this.press) * 0.18;
        this.pressVelocity *= 0.64;
        this.press += this.pressVelocity;
      }

      const pull = Math.min(1, Math.hypot(this.x, this.y) / 18);
      const angle = Math.atan2(this.y, this.x || 0.001);
      const stretchX = 1 + Math.max(0, this.press) * 0.05 + pull * 0.15;
      const stretchY = 1 + Math.max(0, this.press) * 0.035 - pull * 0.06;
      const pressScale = 1 + Math.max(0, this.press) * 0.065;

      this.button.style.setProperty('--pull-x', `${this.x * 0.56}px`);
      this.button.style.setProperty('--pull-y', `${this.y * 0.56}px`);
      this.button.style.setProperty('--pull-angle', `${angle}rad`);
      this.button.style.setProperty('--stretch-x', stretchX.toFixed(4));
      this.button.style.setProperty('--stretch-y', stretchY.toFixed(4));
      this.button.style.setProperty('--press-scale', pressScale.toFixed(4));
      this.button.style.setProperty('--press', `${clamp(this.press, 0, 1)}`);
      this.button.style.setProperty('--glow-x', `${this.glowX.toFixed(2)}%`);
      this.button.style.setProperty('--glow-y', `${this.glowY.toFixed(2)}%`);
      this.glass.setLensOpacity(0.48 + clamp(this.press, 0, 1) * 0.22);
      this.glass.setPosition(0.5, 0.5);
      this.glass.setTransform({
        lift: 1 + clamp(this.press, 0, 1) * 0.05,
        stretchX: 1,
        stretchY: 1,
      });

      const settled = !this.pressed
        && this.targetPress === 0
        && this.press < 0.005
        && Math.abs(this.vx) < 0.01 && Math.abs(this.vy) < 0.01
        && Math.abs(this.targetX - this.x) < 0.01 && Math.abs(this.targetY - this.y) < 0.01
        && Math.abs(this.pressVelocity) < 0.005;
      if (settled) {
        this.raf = null;
        return;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}

document.querySelectorAll('[data-elastic-button]').forEach((button) => new ElasticGlassButton(button));

// Toggle group
const toggleContainer = document.querySelector('#toggle-demo');
if (toggleContainer) new ToggleGroupGlass(toggleContainer);

// QR code (canvas-drawn, WebGL refraction on tap)
const qrWrap = document.querySelector('#qr-wrap');
const qrCanvas = document.querySelector('#qr-canvas');
if (qrCanvas && qrWrap) {
  const size = 512;
  qrCanvas.width = size;
  qrCanvas.height = size;
  const ctx = qrCanvas.getContext('2d');

  // Draw QR-like pattern
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000000';
  const cell = 16;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const signal = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      if (signal - Math.floor(signal) > 0.5) ctx.fillRect(x, y, cell, cell);
    }
  }
  // Position markers
  const markers = [
    [cell * 2, cell * 2, cell * 7],
    [size - cell * 9, cell * 2, cell * 7],
    [cell * 2, size - cell * 9, cell * 7],
  ];
  markers.forEach(([mx, my, ms]) => {
    ctx.fillRect(mx, my, ms, ms);
    ctx.clearRect(mx + cell, my + cell, ms - cell * 2, ms - cell * 2);
    ctx.fillRect(mx + cell * 2, my + cell * 2, ms - cell * 4, ms - cell * 4);
  });

  let qrRenderer = null;
  let qrLens = null;
  qrWrap.addEventListener('click', () => {
    if (!qrRenderer) {
      const wglCanvas = document.createElement('canvas');
      wglCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
      qrWrap.appendChild(wglCanvas);
      qrRenderer = initRefraction(wglCanvas, qrCanvas);
      qrRenderer.start();
    }
    const { map } = generateLensMap({ lensW: 140, lensH: 140, borderRadius: 40, scale: 28, depth: 1.2, curvature: 4 });
    const img = new Image();
    img.onload = () => {
      qrLens = {
        x: 0.5, y: 0.5,
        w: 140, h: 140,
        scale: 28, chroma: 0.22,
        mapImg: img,
      };
      qrRenderer.setLenses([qrLens]);
      setTimeout(() => {
        if (qrRenderer) qrRenderer.setLenses([]);
      }, 600);
    };
    img.src = map;
  });
}

// Video player (glass buttons with SVG filter, WebGL on Safari)
const video = document.querySelector('#demo-video');
const playBtn = document.querySelector('#play-btn');
const pauseBtn = document.querySelector('#pause-btn');
if (video && playBtn && pauseBtn) {
  playBtn.addEventListener('click', () => {
    const playAttempt = video.play();
    if (playAttempt?.catch) playAttempt.catch(() => {});
  });
  pauseBtn.addEventListener('click', () => video.pause());

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) {
    // WebGL overlay for Safari
    const vCanvas = document.querySelector('#video-canvas');
    const vWrap = document.querySelector('#video-wrap');
    if (vCanvas && vWrap) {
      let vRenderer = null;
      video.addEventListener('play', () => {
        if (!vRenderer) {
          vRenderer = initRefraction(vCanvas, video);
          vRenderer.start();
        }
      });

      // Generate maps for buttons and update positions
      function updateVideoLenses() {
        if (!vRenderer) return;
        const wrapRect = vWrap.getBoundingClientRect();
        const playRect = playBtn.getBoundingClientRect();
        const pauseRect = pauseBtn.getBoundingClientRect();

        const { map: pMap } = generateLensMap({ lensW: 90, lensH: 44, borderRadius: 22, scale: 14 });
        const { map: sMap } = generateLensMap({ lensW: 90, lensH: 44, borderRadius: 22, scale: 14 });
        const pImg = new Image();
        const sImg = new Image();
        let loaded = 0;
        const onload = () => {
          loaded += 1;
          if (loaded < 2) return;
          vRenderer.setLenses([
            {
              x: (playRect.left + playRect.width / 2 - wrapRect.left) / wrapRect.width,
              y: (playRect.top + playRect.height / 2 - wrapRect.top) / wrapRect.height,
              w: 90, h: 44, scale: 14, chroma: 0.12,
              mapImg: pImg,
            },
            {
              x: (pauseRect.left + pauseRect.width / 2 - wrapRect.left) / wrapRect.width,
              y: (pauseRect.top + pauseRect.height / 2 - wrapRect.top) / wrapRect.height,
              w: 90, h: 44, scale: 14, chroma: 0.12,
              mapImg: sImg,
            },
          ]);
        };
        pImg.onload = onload;
        sImg.onload = onload;
        pImg.src = pMap;
        sImg.src = sMap;
      }

      // Update lenses when layout changes when supported.
      if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(updateVideoLenses);
        ro.observe(vWrap);
      } else {
        window.addEventListener('resize', updateVideoLenses);
      }
    }
  } else {
    // SVG filter path for non-Safari browsers
    [playBtn, pauseBtn].forEach((btn) => {
      new LiquidGlass(btn, {
        lensW: 90,
        lensH: 44,
        borderRadius: 22,
        x: 0.5,
        y: 0.5,
        scale: 14,
        depth: 0.6,
        curvature: 3,
        chroma: 0.12,
        glow: 0.2,
        edge: 0.28,
      });
    });
  }
}

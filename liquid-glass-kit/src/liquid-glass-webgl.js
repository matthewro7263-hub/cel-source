const VERT = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_source;
uniform sampler2D u_map;
uniform vec2 u_scale;
uniform float u_chroma;
uniform vec4 u_lens;
uniform vec2 u_sourceSize;

void main() {
  vec2 px = vec2(1.0) / u_sourceSize;
  vec2 uv = v_uv;

  vec2 mapUV = (uv - u_lens.xy) / u_lens.zw;
  mapUV = clamp(mapUV, 0.0, 1.0);

  vec4 mapSample = texture2D(u_map, mapUV);
  vec2 displacement = (mapSample.rg - 0.5) * u_scale * 2.0;

  vec2 shifted = uv + displacement;

  float r = texture2D(u_source, shifted + vec2(u_chroma * px.x, 0.0)).r;
  float g = texture2D(u_source, shifted).g;
  float b = texture2D(u_source, shifted - vec2(u_chroma * px.x, 0.0)).b;

  vec3 col = vec3(r, g, b);

  float shine = mapSample.a;
  col += vec3(shine * 0.25);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertSrc, fragSrc) {
  const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function createTexture(gl, image) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return tex;
}

export class GlassWebGLRenderer {
  constructor(canvas, source) {
    this.canvas = canvas;
    this.source = source;
    this.gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
    if (!this.gl) throw new Error('WebGL not supported');

    this.program = createProgram(this.gl, VERT, FRAG);
    this.gl.useProgram(this.program);

    const buf = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), this.gl.STATIC_DRAW);

    const posLoc = this.gl.getAttribLocation(this.program, 'a_position');
    this.gl.enableVertexAttribArray(posLoc);
    this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

    this.uSource = this.gl.getUniformLocation(this.program, 'u_source');
    this.uMap = this.gl.getUniformLocation(this.program, 'u_map');
    this.uScale = this.gl.getUniformLocation(this.program, 'u_scale');
    this.uChroma = this.gl.getUniformLocation(this.program, 'u_chroma');
    this.uLens = this.gl.getUniformLocation(this.program, 'u_lens');
    this.uSourceSize = this.gl.getUniformLocation(this.program, 'u_sourceSize');

    this.sourceTex = createTexture(this.gl, null);
    this.mapTex = createTexture(this.gl, null);

    this.lenses = [];
    this.running = false;
    this.needsResize = true;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  setSource(source) {
    this.source = source;
  }

  setLenses(lenses) {
    this.lenses = lenses.map((l) => ({
      x: l.x ?? 0.5,
      y: l.y ?? 0.5,
      w: l.w ?? 120,
      h: l.h ?? 60,
      radius: l.radius ?? 30,
      scale: l.scale ?? 20,
      depth: l.depth ?? 1,
      curvature: l.curvature ?? 4,
      splay: l.splay ?? 1,
      chroma: l.chroma ?? 0.22,
      mapUrl: l.mapUrl ?? null,
      mapImg: l.mapImg ?? null,
    }));
  }

  draw() {
    this.resize();
    const gl = this.gl;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!this.source) return;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);

    gl.uniform1i(this.uSource, 0);
    gl.uniform1i(this.uMap, 1);
    gl.uniform2f(this.uSourceSize, this.canvas.clientWidth, this.canvas.clientHeight);

    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    // Drawable buffer is sized in device pixels; convert CSS px lens rects to scissor space.
    const scaleX = this.canvas.width / Math.max(1, cw);
    const scaleY = this.canvas.height / Math.max(1, ch);

    // Each lens draws a fullscreen quad, so without a scissor the later lens would
    // overwrite earlier ones with unrefracted source. Clip every draw to its lens rect
    // and leave the rest of the overlay transparent so the live source shows through.
    gl.enable(gl.SCISSOR_TEST);
    for (const lens of this.lenses) {
      if (!lens.mapImg) continue;

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.mapTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lens.mapImg);

      const rectLeft = lens.x * cw - lens.w / 2;
      const rectTop = lens.y * ch - lens.h / 2;

      const lx = rectLeft / cw;
      const ly = rectTop / ch;
      const lw = lens.w / cw;
      const lh = lens.h / ch;

      gl.uniform4f(this.uLens, lx, ly, lw, lh);
      gl.uniform2f(this.uScale, lens.scale / cw, lens.scale / ch);
      gl.uniform1f(this.uChroma, lens.chroma);

      const sx = Math.round(rectLeft * scaleX);
      const sw = Math.round(lens.w * scaleX);
      const sh = Math.round(lens.h * scaleY);
      // WebGL scissor origin is bottom-left, so flip the Y axis.
      const sy = Math.round(this.canvas.height - rectTop * scaleY - sh);
      gl.scissor(sx, sy, sw, sh);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.SCISSOR_TEST);
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }
}

export function initRefraction(canvas, source) {
  return new GlassWebGLRenderer(canvas, source);
}

if (typeof window !== 'undefined') {
  window.GlassWebGLRenderer = GlassWebGLRenderer;
  window.initRefraction = initRefraction;
}

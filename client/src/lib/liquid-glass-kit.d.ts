export interface LiquidGlassOptions {
  lensW?: number;
  lensH?: number;
  borderRadius?: number;
  x?: number;
  y?: number;
  scale?: number;
  depth?: number;
  curvature?: number;
  splay?: number;
  chroma?: number;
  blur?: number;
  glow?: number;
  edge?: number;
  specularAngle?: number;
  followPointer?: boolean;
  fit?: 'inline' | 'block';
  refractionTarget?: any;
  active?: boolean;
}

export interface LensMapResult {
  map: string;
  width: number;
  height: number;
  scale: number;
  chromaAmount: number;
}

export class LiquidGlass {
  constructor(root: HTMLElement, options?: LiquidGlassOptions);
  init(): void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerLeave: () => void;
  enableDrag(options?: { onMove?: (x: number, y: number) => void }): void;
  render(): void;
  syncFilter(): void;
  setActive(active: boolean): void;
  setLensOpacity(opacity: number): void;
  setTransform(transform: { lift?: number; stretchX?: number; stretchY?: number }): void;
  syncStyles(): void;
  setPosition(x: number, y?: number): void;
  getFilterGeometry(): {
    rootBounds: DOMRect;
    targetBounds: DOMRect;
    targetOffsetLeft: number;
    targetOffsetTop: number;
  };
  update(options: Partial<LiquidGlassOptions>): void;
  destroy(): void;
}

export class SliderGlass {
  constructor(root: HTMLElement, options?: {
    value?: number;
    lensW?: number;
    lensH?: number;
    borderRadius?: number;
    scale?: number;
    depth?: number;
    curvature?: number;
    chroma?: number;
    glow?: number;
    edge?: number;
  });
  onKeyDown: (event: KeyboardEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  activate(): void;
  releaseInteraction: () => void;
  updateFromPointer(event: PointerEvent): void;
  start(): void;
  sync(): void;
  destroy(): void;
}

export class SwitchGlass {
  constructor(track: HTMLElement, options?: {
    label?: string;
    [key: string]: any;
  });
  onKeyDown: (event: KeyboardEvent) => void;
  onPointerDown: (event: PointerEvent) => void;
  updateFromPointer(event: PointerEvent): void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerUp: (event: PointerEvent) => void;
  activate(): void;
  startPulse(): void;
  getPulsePress(): number;
  setOn(on: boolean, options?: { animate?: boolean }): void;
  start(): void;
  sync(): void;
  destroy(): void;
}

export function generateLensMap(options?: LiquidGlassOptions): LensMapResult;
export function attachLiquidGlass(selector?: string, options?: LiquidGlassOptions): LiquidGlass[];

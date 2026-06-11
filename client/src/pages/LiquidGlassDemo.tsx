"use client";

import React, { useState } from "react";
import { LiquidGlass } from "@/components/ui/liquid-glass";
import { GlassButton } from "@/components/ui/glass-button";
import { LiquidGlassSlider } from "@/components/ui/liquid-glass-slider";
import { LiquidGlassSwitch } from "@/components/ui/liquid-glass-switch";
import { getOptimalGlassMode, GlassMode } from "@/lib/useLiquidGlass";

/**
 * Liquid Glass Kit Demo Page
 * 
 * This page showcases the Liquid Glass Kit integration with:
 * - SVG-filter based refraction effects
 * - CSS-based glass effects with fallback
 * - Cross-browser compatibility
 * - Performance optimizations
 */
export default function LiquidGlassDemo() {
  const [sliderValue, setSliderValue] = useState(0.62);
  const [switchChecked, setSwitchChecked] = useState(false);
  const [glassMode, setGlassMode] = useState<GlassMode | 'hybrid'>('hybrid');
  const currentMode = glassMode === 'hybrid' ? getOptimalGlassMode() : glassMode;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Liquid Glass Kit Demo
          </h1>
          <p className="text-xl text-purple-200">
            SVG-filter based refraction with CSS fallback
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md">
            <span className="text-purple-200">Current Mode:</span>
            <span className="font-semibold text-white">{currentMode.toUpperCase()}</span>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="mb-12 flex justify-center gap-4">
          <GlassButton
            variant={glassMode === 'hybrid' ? 'primary' : 'ghost'}
            size="md"
            onClick={() => setGlassMode('hybrid')}
          >
            Hybrid (Auto)
          </GlassButton>
          <GlassButton
            variant={glassMode === 'svg' ? 'primary' : 'ghost'}
            size="md"
            onClick={() => setGlassMode('svg')}
          >
            SVG Filters
          </GlassButton>
          <GlassButton
            variant={glassMode === 'css' ? 'primary' : 'ghost'}
            size="md"
            onClick={() => setGlassMode('css')}
          >
            CSS Only
          </GlassButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* LiquidGlass Cards */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white mb-4">LiquidGlass Cards</h2>
            
            <LiquidGlass
              depth="subtle"
              refractionMode={glassMode}
              className="p-6 rounded-3xl"
            >
              <h3 className="text-xl font-bold text-slate-800 mb-2">Subtle Depth</h3>
              <p className="text-slate-600">
                CSS-based glass with subtle shimmer and blur effects.
              </p>
            </LiquidGlass>

            <LiquidGlass
              depth="normal"
              refractionMode={glassMode}
              className="p-6 rounded-3xl"
            >
              <h3 className="text-xl font-bold text-slate-800 mb-2">Normal Depth</h3>
              <p className="text-slate-600">
                Balanced glass effect with iridescence and depth.
              </p>
            </LiquidGlass>

            <LiquidGlass
              depth="strong"
              refractionMode={glassMode}
              className="p-6 rounded-3xl"
            >
              <h3 className="text-xl font-bold text-slate-800 mb-2">Strong Depth</h3>
              <p className="text-slate-600">
                Maximum glass effect with intense refraction.
              </p>
            </LiquidGlass>
          </div>

          {/* Glass Buttons */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white mb-4">Glass Buttons</h2>
            
            <div className="flex flex-col gap-4">
              <GlassButton
                variant="primary"
                size="pill"
                useRefraction={glassMode === 'svg' || glassMode === 'hybrid'}
                refractionMode={glassMode}
              >
                Primary with Refraction
              </GlassButton>

              <GlassButton
                variant="primary"
                size="md"
                useRefraction={glassMode === 'svg' || glassMode === 'hybrid'}
                refractionMode={glassMode}
              >
                Primary Medium
              </GlassButton>

              <GlassButton
                variant="ghost"
                size="md"
              >
                Ghost Button
              </GlassButton>

              <GlassButton
                variant="toolbar"
                size="round"
              >
                🔔
              </GlassButton>
            </div>
          </div>

          {/* Interactive Components */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-white mb-4">Interactive Components</h2>
            
            <LiquidGlass className="p-6 rounded-3xl">
              <div className="space-y-6">
                <div>
                  <label className="block text-slate-700 font-semibold mb-2">
                    Liquid Glass Slider
                  </label>
                  <LiquidGlassSlider
                    value={sliderValue}
                    onChange={setSliderValue}
                  />
                  <div className="mt-2 text-slate-600 text-sm">
                    Value: {Math.round(sliderValue * 100)}%
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-2">
                    Liquid Glass Switch
                  </label>
                  <LiquidGlassSwitch
                    checked={switchChecked}
                    onCheckedChange={setSwitchChecked}
                    label="Enable feature"
                  />
                  <div className="mt-2 text-slate-600 text-sm">
                    Status: {switchChecked ? 'On' : 'Off'}
                  </div>
                </div>
              </div>
            </LiquidGlass>
          </div>
        </div>

        {/* Browser Compatibility Info */}
        <div className="mt-12">
          <LiquidGlass className="p-8 rounded-3xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">
              Cross-Browser Compatibility
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Supported Browsers</h3>
                <ul className="text-slate-600 space-y-1">
                  <li>✓ Chrome/Edge 90+ (full SVG support)</li>
                  <li>✓ Firefox 88+ (full SVG support)</li>
                  <li>✓ Safari 14+ (SVG with caveats)</li>
                  <li>✓ Mobile Safari 14+ (performance limits)</li>
                  <li>✓ Chrome Android 90+</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-2">Fallback Strategy</h3>
                <ul className="text-slate-600 space-y-1">
                  <li>• SVG filters → CSS backdrop-filter</li>
                  <li>• CSS backdrop-filter → CSS opacity</li>
                  <li>• Feature detection (no UA sniffing)</li>
                  <li>• Performance-based auto-degradation</li>
                  <li>• Reduced motion support</li>
                </ul>
              </div>
            </div>
          </LiquidGlass>
        </div>

        {/* Performance Info */}
        <div className="mt-8">
          <LiquidGlass className="p-6 rounded-3xl">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Performance Notes</h2>
            <ul className="text-slate-600 space-y-1">
              <li>• CSS-only glass: &lt; 1ms render time</li>
              <li>• SVG refraction: &lt; 16ms per frame (60fps)</li>
              <li>• Max 10 concurrent SVG lenses recommended</li>
              <li>• Mobile: 50% reduced displacement, max 3 lenses</li>
            </ul>
          </LiquidGlass>
        </div>
      </div>
    </div>
  );
}

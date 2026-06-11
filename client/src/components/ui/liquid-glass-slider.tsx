"use client";

import React, { useRef, useEffect } from "react";
// @ts-ignore - TypeScript declarations are in liquid-glass-kit.d.ts
import { SliderGlass } from "@/lib/liquid-glass-kit.js";
import { cn } from "@/lib/utils";

export interface LiquidGlassSliderProps {
  value?: number;
  onChange?: (value: number) => void;
  className?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * LiquidGlassSlider — Slider with SVG-filter refraction on the thumb
 * 
 * Uses the Liquid Glass Kit's SliderGlass class for true liquid refraction
 * on the slider thumb during interaction. Falls back to CSS-only styling
 * when SVG filters are not supported.
 */
export const LiquidGlassSlider = React.forwardRef<HTMLDivElement, LiquidGlassSliderProps>(
  ({ 
    value = 0.62, 
    onChange, 
    className, 
    disabled = false,
    min = 0,
    max = 100,
    step = 1,
    ...props 
  }, ref) => {
    const sliderRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<SliderGlass | null>(null);

    useEffect(() => {
      if (!sliderRef.current || disabled) return;

      try {
        const instance = new SliderGlass(sliderRef.current, {
          value,
        });
        instanceRef.current = instance;

        // Listen for value changes
        const handleValueChange = () => {
          const ariaValue = sliderRef.current?.getAttribute('aria-valuenow');
          if (ariaValue && onChange) {
            onChange(parseInt(ariaValue, 10) / 100);
          }
        };

        const observer = new MutationObserver(handleValueChange);
        observer.observe(sliderRef.current, { attributes: true, attributeFilter: ['aria-valuenow'] });

        return () => {
          observer.disconnect();
          if (instanceRef.current) {
            try {
              instanceRef.current.destroy();
            } catch (error) {
              console.warn('Failed to destroy SliderGlass:', error);
            }
            instanceRef.current = null;
          }
        };
      } catch (error) {
        console.warn('Failed to initialize SliderGlass, falling back to CSS:', error);
      }
    }, [disabled]);

    // Update value when prop changes
    useEffect(() => {
      if (instanceRef.current && !disabled) {
        // SliderGlass doesn't have a direct setValue method,
        // so we'll let the component handle its own state
      }
    }, [value, disabled]);

    return (
      <div
        ref={sliderRef}
        className={cn("lgk-slider", disabled && "opacity-50 pointer-events-none", className)}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 100)}
        aria-disabled={disabled}
        {...props}
      />
    );
  }
);

LiquidGlassSlider.displayName = "LiquidGlassSlider";

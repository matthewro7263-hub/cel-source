"use client";

import React, { useRef, useEffect } from "react";
// @ts-ignore - TypeScript declarations are in liquid-glass-kit.d.ts
import { SwitchGlass } from "@/lib/liquid-glass-kit.js";
import { cn } from "@/lib/utils";

export interface LiquidGlassSwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
  label?: string;
}

/**
 * LiquidGlassSwitch — Toggle switch with SVG-filter refraction
 * 
 * Uses the Liquid Glass Kit's SwitchGlass class for true liquid refraction
 * on the switch thumb during interaction. Falls back to CSS-only styling
 * when SVG filters are not supported.
 */
export const LiquidGlassSwitch = React.forwardRef<HTMLDivElement, LiquidGlassSwitchProps>(
  ({ 
    checked = false, 
    onCheckedChange, 
    className, 
    disabled = false,
    label = "Toggle switch",
    ...props 
  }, ref) => {
    const switchRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<SwitchGlass | null>(null);

    useEffect(() => {
      if (!switchRef.current || disabled) return;

      try {
        const instance = new SwitchGlass(switchRef.current, {
          label,
        });
        instanceRef.current = instance;

        // Listen for checked changes
        const handleCheckedChange = () => {
          const isChecked = switchRef.current?.getAttribute('aria-checked') === 'true';
          if (onCheckedChange) {
            onCheckedChange(isChecked);
          }
        };

        const observer = new MutationObserver(handleCheckedChange);
        observer.observe(switchRef.current, { attributes: true, attributeFilter: ['aria-checked'] });

        return () => {
          observer.disconnect();
          if (instanceRef.current) {
            try {
              instanceRef.current.destroy();
            } catch (error) {
              console.warn('Failed to destroy SwitchGlass:', error);
            }
            instanceRef.current = null;
          }
        };
      } catch (error) {
        console.warn('Failed to initialize SwitchGlass, falling back to CSS:', error);
      }
    }, [disabled, label]);

    // Update checked state when prop changes
    useEffect(() => {
      if (instanceRef.current && !disabled) {
        instanceRef.current.setOn(checked);
      }
    }, [checked, disabled]);

    return (
      <div
        ref={switchRef}
        className={cn("lgk-switch", disabled && "opacity-50 pointer-events-none", className)}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-disabled={disabled}
        {...props}
      />
    );
  }
);

LiquidGlassSwitch.displayName = "LiquidGlassSwitch";

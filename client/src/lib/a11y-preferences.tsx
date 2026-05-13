import React, { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import { A11yPrefs, InsertA11yPrefs } from "../../../shared/a11y_schema";

interface A11yContextValue {
  prefs: A11yPrefs | undefined;
  updatePrefs: (patch: Partial<InsertA11yPrefs>) => void;
  isLoading: boolean;
}

const A11yContext = createContext<A11yContextValue | undefined>(undefined);

export function A11yProvider({ children }: { children: React.ReactNode }) {
  const { data: prefs, isLoading, refetch } = useQuery<A11yPrefs>({
    queryKey: ["/api/a11y/prefs"],
  });

  const mutation = useMutation({
    mutationFn: async (patch: Partial<InsertA11yPrefs>) => {
      const res = await apiRequest("POST", "/api/a11y/prefs", patch);
      return res.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  useEffect(() => {
    if (!prefs) return;

    const html = document.documentElement;

    if (prefs.focusMode) html.classList.add("a11y-focus-mode");
    else html.classList.remove("a11y-focus-mode");

    if (prefs.dyslexia) html.classList.add("a11y-dyslexia");
    else html.classList.remove("a11y-dyslexia");

    if (prefs.colorblind) html.classList.add("a11y-colorblind");
    else html.classList.remove("a11y-colorblind");

    if (prefs.reducedMotion) html.classList.add("a11y-reduced-motion");
    else html.classList.remove("a11y-reduced-motion");

    if (prefs.largeTouch) html.classList.add("a11y-large-touch");
    else html.classList.remove("a11y-large-touch");
  }, [prefs]);

  useEffect(() => {
    if (!prefs?.audioCues) return;

    const playCue = () => {
      try {
        const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        const ctx = new AudioContextCtor();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.16);
      } catch {
        // Browsers can block audio until the next user gesture.
      }
    };

    window.addEventListener("cel:toast", playCue);
    return () => window.removeEventListener("cel:toast", playCue);
  }, [prefs?.audioCues]);

  return (
    <A11yContext.Provider
      value={{
        prefs,
        isLoading,
        updatePrefs: (patch) => mutation.mutate(patch),
      }}
    >
      {children}
    </A11yContext.Provider>
  );
}

export function useA11y() {
  const context = useContext(A11yContext);
  if (context === undefined) {
    throw new Error("useA11y must be used within an A11yProvider");
  }
  return context;
}

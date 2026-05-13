/**
 * Clip settings dialog — volume, fade in, fade out.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnimaticClipData } from "./types";
import { getAudioContext } from "@/lib/aud_web_audio";
import { useToast } from "@/hooks/use-toast";

interface ClipSettingsDialogProps {
  clip: AnimaticClipData | null;
  onClose: () => void;
  onSave: (clipId: number, patch: { volume: string; fadeInMs: number; fadeOutMs: number; audioDataUrl?: string; label?: string }) => void;
}

export function ClipSettingsDialog({ clip, onClose, onSave }: ClipSettingsDialogProps) {
  const [volume, setVolume] = useState(1.0);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [eqPreset, setEqPreset] = useState("none");
  const [isApplyingEq, setIsApplyingEq] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (clip) {
      setVolume(parseFloat(clip.volume) || 1.0);
      setFadeIn(clip.fadeInMs || 0);
      setFadeOut(clip.fadeOutMs || 0);
      setEqPreset("none");
    }
  }, [clip]);

  if (!clip) return null;

  const handleSave = () => {
    onSave(clip.id, {
      volume: String(volume),
      fadeInMs: Math.round(fadeIn),
      fadeOutMs: Math.round(fadeOut),
    });
    onClose();
  };

  const applyEqPreset = async () => {
    if (eqPreset === "none" || !clip.audioDataUrl) return;
    setIsApplyingEq(true);
    try {
      const ctx = getAudioContext();
      if (!ctx) throw new Error("No audio context");

      let arrayBuffer;
      if (clip.audioDataUrl.startsWith('data:')) {
        const b64 = clip.audioDataUrl.split(',')[1];
        const binaryStr = atob(b64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
        arrayBuffer = bytes.buffer;
      } else {
        const res = await fetch(clip.audioDataUrl);
        arrayBuffer = await res.arrayBuffer();
      }

      const offlineCtx = new OfflineAudioContext(1, 1, 44100);
      const originalBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
      
      let renderCtx: OfflineAudioContext;
      
      if (eqPreset === "monster") {
        renderCtx = new OfflineAudioContext(originalBuffer.numberOfChannels, Math.ceil(originalBuffer.length / 0.6), originalBuffer.sampleRate);
      } else {
        renderCtx = new OfflineAudioContext(originalBuffer.numberOfChannels, originalBuffer.length, originalBuffer.sampleRate);
      }
      
      const source = renderCtx.createBufferSource();
      source.buffer = originalBuffer;

      // Filter chain
      let lastNode: AudioNode = source;

      if (eqPreset === "podcast") {
        // Crisp podcast
        const hp = renderCtx.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 80;
        
        const presence = renderCtx.createBiquadFilter();
        presence.type = "peaking"; presence.frequency.value = 4000; presence.Q.value = 1; presence.gain.value = 3;
        
        source.connect(hp); hp.connect(presence);
        lastNode = presence;
      } else if (eqPreset === "radio") {
        // Muffled radio
        const hp = renderCtx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 400;
        const lp = renderCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000;
        source.connect(hp); hp.connect(lp);
        lastNode = lp;
      } else if (eqPreset === "phone") {
        // Phone call
        const hp = renderCtx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 300;
        const lp = renderCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3400;
        const distortion = renderCtx.createWaveShaper();
        const curve = new Float32Array(44100);
        for (let i = 0; i < 44100; i++) {
          const x = (i * 2) / 44100 - 1;
          curve[i] = (3 + 20) * x * 20 * (Math.PI / 180) / (Math.PI + 20 * Math.abs(x));
        }
        distortion.curve = curve;
        source.connect(hp); hp.connect(lp); lp.connect(distortion);
        lastNode = distortion;
      } else if (eqPreset === "monster") {
        // Monster pitch (simple playback rate adjust, requires longer buffer)
        source.playbackRate.value = 0.6;
        source.connect(renderCtx.destination);
        lastNode = source; // dummy
      } else if (eqPreset === "bright") {
        // Bright
        const hs = renderCtx.createBiquadFilter(); hs.type = "highshelf"; hs.frequency.value = 5000; hs.gain.value = 6;
        source.connect(hs);
        lastNode = hs;
      }

      if (eqPreset !== "monster") {
        lastNode.connect(renderCtx.destination);
      }
      
      source.start();
      const renderedBuffer = await renderCtx.startRendering();

      // Convert back to wav
      const wavData = audioBufferToWav(renderedBuffer);
      const blob = new Blob([wavData], { type: 'audio/wav' });
      const reader = new FileReader();
      reader.onloadend = () => {
        onSave(clip.id, {
          volume: String(volume),
          fadeInMs: Math.round(fadeIn),
          fadeOutMs: Math.round(fadeOut),
          audioDataUrl: reader.result as string,
          label: `${clip.label} (${eqPreset})`
        });
        onClose();
        toast({ title: "EQ applied and clip replaced" });
      };
      reader.readAsDataURL(blob);

    } catch (e: any) {
      toast({ title: "Failed to apply EQ", description: e.message, variant: "destructive" });
    } finally {
      setIsApplyingEq(false);
    }
  };

  return (
    <Dialog open={!!clip} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Clip Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Volume */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Volume</Label>
              <span className="text-sm text-muted-foreground">{Math.round(volume * 100)}%</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[volume]}
              onValueChange={([v]) => setVolume(v)}
            />
          </div>

          {/* Fade In */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fade In</Label>
              <span className="text-sm text-muted-foreground">{fadeIn}ms</span>
            </div>
            <Slider
              min={0}
              max={Math.min(2000, clip.durationMs / 2)}
              step={50}
              value={[fadeIn]}
              onValueChange={([v]) => setFadeIn(v)}
            />
          </div>

          {/* Fade Out */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fade Out</Label>
              <span className="text-sm text-muted-foreground">{fadeOut}ms</span>
            </div>
            <Slider
              min={0}
              max={Math.min(2000, clip.durationMs / 2)}
              step={50}
              value={[fadeOut]}
              onValueChange={([v]) => setFadeOut(v)}
            />
          </div>

          {clip.sourceKind === "audio_data" && (
            <div className="space-y-2 pt-4 border-t border-white/10">
              <Label>Dialogue EQ Preset (re-renders clip)</Label>
              <div className="flex gap-2">
                <Select value={eqPreset} onValueChange={setEqPreset}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="podcast">Crisp Podcast</SelectItem>
                    <SelectItem value="radio">Muffled Radio</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="monster">Monster Pitch</SelectItem>
                    <SelectItem value="bright">Bright</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={applyEqPreset} disabled={eqPreset === "none" || isApplyingEq}>
                  {isApplyingEq ? "Baking..." : "Apply"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Volume/Fades</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function audioBufferToWav(buffer: AudioBuffer) {
  const numChannels = 1; // Downmix to mono
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const result = new Float32Array(buffer.length);
  buffer.copyFromChannel(result, 0); // Using channel 0
  
  const dataLength = result.length * (bitDepth / 8) * numChannels;
  const bufferWav = new ArrayBuffer(44 + dataLength);
  const view = new DataView(bufferWav);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  let offset = 44;
  for (let i = 0; i < result.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, result[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return bufferWav;
}

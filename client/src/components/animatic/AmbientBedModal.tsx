import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { getAmbientLoops } from "@/constants/aud_ambient_loops";
import { getAudioContext } from "@/lib/aud_web_audio";
import { Play, Square } from "lucide-react";

interface AmbientBedModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (audioDataUrl: string, label: string) => void;
}

export function AmbientBedModal({ open, onClose, onAdd }: AmbientBedModalProps) {
  const [mix, setMix] = useState({
    wind: 0, rain: 0, city: 0, roomHum: 0, crowd: 0, forest: 0
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const sourcesRef = useRef<{ [key: string]: AudioBufferSourceNode }>({});
  const gainsRef = useRef<{ [key: string]: GainNode }>({});
  const buffersRef = useRef<any>(null);

  useEffect(() => {
    if (open && !buffersRef.current) {
      getAmbientLoops().then(b => buffersRef.current = b);
    }
    return () => {
      stopPreview();
    };
  }, [open]);

  const stopPreview = () => {
    Object.values(sourcesRef.current).forEach(s => {
      try { s.stop(); } catch(e){}
    });
    sourcesRef.current = {};
    Object.values(gainsRef.current).forEach(g => {
      try { g.disconnect(); } catch(e){}
    });
    gainsRef.current = {};
    setIsPlaying(false);
  };

  const startPreview = () => {
    if (!buffersRef.current) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    
    stopPreview();
    
    Object.keys(mix).forEach(key => {
      const source = ctx.createBufferSource();
      source.buffer = buffersRef.current[key];
      source.loop = true;
      
      const gain = ctx.createGain();
      gain.gain.value = (mix as any)[key] / 100;
      
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      
      sourcesRef.current[key] = source;
      gainsRef.current[key] = gain;
    });
    
    setIsPlaying(true);
  };

  const updateMix = (key: string, val: number) => {
    setMix(m => ({ ...m, [key]: val }));
    if (gainsRef.current[key]) {
      gainsRef.current[key].gain.value = val / 100;
    }
  };

  const handleApply = async () => {
    if (!buffersRef.current) return;
    
    // Render mixed loop via OfflineAudioContext
    const sampleRate = buffersRef.current.wind.sampleRate;
    const duration = 5; // 5 second loop
    const offlineCtx = new OfflineAudioContext(1, duration * sampleRate, sampleRate);
    
    Object.keys(mix).forEach(key => {
      const vol = (mix as any)[key] / 100;
      if (vol === 0) return;
      
      const source = offlineCtx.createBufferSource();
      source.buffer = buffersRef.current[key];
      
      const gain = offlineCtx.createGain();
      gain.gain.value = vol;
      
      source.connect(gain);
      gain.connect(offlineCtx.destination);
      source.start();
    });
    
    const renderedBuffer = await offlineCtx.startRendering();
    
    // Convert to WAV
    const wavData = audioBufferToWav(renderedBuffer);
    const blob = new Blob([wavData], { type: 'audio/wav' });
    const reader = new FileReader();
    reader.onloadend = () => {
      onAdd(reader.result as string, "Ambient Bed");
      onClose();
    };
    reader.readAsDataURL(blob);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ambient Bed Builder</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex justify-center mb-4">
            <Button variant="secondary" onClick={isPlaying ? stopPreview : startPreview} className="w-full">
              {isPlaying ? <><Square size={16} className="mr-2"/> Stop Preview</> : <><Play size={16} className="mr-2"/> Preview Mix</>}
            </Button>
          </div>
          
          {Object.keys(mix).map(key => (
            <div key={key} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="text-muted-foreground">{(mix as any)[key]}%</span>
              </div>
              <Slider min={0} max={100} step={1} value={[(mix as any)[key]]} onValueChange={([v]) => updateMix(key, v)} />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApply}>Add to Timeline</Button>
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

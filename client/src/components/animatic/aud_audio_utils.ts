import { getAudioContext } from "@/lib/aud_web_audio";

export async function detectBeats(audioDataUrl: string): Promise<number[]> {
  const ctx = getAudioContext();
  if (!ctx) return [];
  
  try {
    let arrayBuffer;
    if (audioDataUrl.startsWith('data:')) {
      const b64 = audioDataUrl.split(',')[1];
      const binaryStr = atob(b64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    } else {
      const res = await fetch(audioDataUrl);
      arrayBuffer = await res.arrayBuffer();
    }
    
    // Create a new context just for offline decoding so we don't mess up the shared one
    const offlineCtx = new OfflineAudioContext(1, 1, 44100);
    const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0);
    const peaks = [];
    const threshold = 0.8;
    
    // Very naive transient detection
    const step = Math.floor(audioBuffer.sampleRate / 10); // 100ms window
    
    for (let i = 0; i < channelData.length; i += step) {
      let max = 0;
      for (let j = 0; j < step && i + j < channelData.length; j++) {
        const val = Math.abs(channelData[i + j]);
        if (val > max) max = val;
      }
      if (max > threshold) {
        peaks.push((i / audioBuffer.sampleRate) * 1000);
      }
    }
    
    // Filter out peaks that are too close to each other (e.g., < 200ms)
    const filteredPeaks: number[] = [];
    let lastPeak = -1000;
    for (const p of peaks) {
      if (p - lastPeak > 200) {
        filteredPeaks.push(p);
        lastPeak = p;
      }
    }
    
    return filteredPeaks;
  } catch (e) {
    console.error("Beat detection failed:", e);
    return [];
  }
}

export function detectLipSync(audioBuffer: AudioBuffer, startMs: number): any {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  
  const stepMs = 50; // 20fps
  const stepSamples = Math.floor(sampleRate * (stepMs / 1000));
  
  const timeline = [];
  
  for (let i = 0; i < channelData.length; i += stepSamples) {
    let energy = 0;
    let zeroCrossings = 0;
    let lastVal = 0;
    
    for (let j = 0; j < stepSamples && i + j < channelData.length; j++) {
      const val = channelData[i + j];
      energy += val * val;
      
      if (j > 0 && ((val >= 0 && lastVal < 0) || (val < 0 && lastVal >= 0))) {
        zeroCrossings++;
      }
      lastVal = val;
    }
    
    energy = energy / stepSamples;
    const zcr = zeroCrossings / stepSamples;
    
    let shape = "rest";
    if (energy > 0.01) {
      if (zcr > 0.1) shape = "E";
      else if (zcr > 0.05) shape = "A";
      else shape = "O";
    } else if (energy > 0.001) {
      shape = "M";
    }
    
    timeline.push({
      timeMs: startMs + (i / sampleRate) * 1000,
      shape
    });
  }
  
  return timeline;
}

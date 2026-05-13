import { getAudioContext } from "../lib/aud_web_audio";

// Generate simple loops in browser via Web Audio API
export const getAmbientLoops = async () => {
  const ctx = getAudioContext();
  if (!ctx) return null;
  const sampleRate = ctx.sampleRate;
  
  const generateBuffer = (generator: (i: number) => number, duration: number) => {
    const frames = duration * sampleRate;
    const buffer = ctx.createBuffer(1, frames, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = generator(i);
    }
    return buffer;
  };

  const noiseGenerator = () => Math.random() * 2 - 1;
  const windGenerator = (i: number) => {
    const t = i / sampleRate;
    return noiseGenerator() * (0.5 + 0.5 * Math.sin(t * 0.5)) * 0.1;
  };
  const rainGenerator = (i: number) => {
     return noiseGenerator() * 0.2 + (Math.random() < 0.05 ? Math.random() * 0.5 : 0);
  };
  const cityGenerator = (i: number) => noiseGenerator() * 0.05;
  const roomHumGenerator = (i: number) => {
    const t = i / sampleRate;
    return Math.sin(t * Math.PI * 2 * 60) * 0.05 + noiseGenerator() * 0.01;
  };
  const crowdGenerator = (i: number) => noiseGenerator() * 0.1;
  const forestGenerator = (i: number) => noiseGenerator() * 0.05 + (Math.random() < 0.001 ? Math.sin(i * 0.1) * 0.2 : 0);

  return {
    wind: generateBuffer(windGenerator, 5),
    rain: generateBuffer(rainGenerator, 5),
    city: generateBuffer(cityGenerator, 5),
    roomHum: generateBuffer(roomHumGenerator, 5),
    crowd: generateBuffer(crowdGenerator, 5),
    forest: generateBuffer(forestGenerator, 5)
  };
};
// Shared web audio context utility to prevent creating multiple contexts
export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  // @ts-ignore
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!window._sharedAudioContext) {
    window._sharedAudioContext = new AudioContext();
  }
  return window._sharedAudioContext;
};

declare global {
  interface Window {
    _sharedAudioContext: AudioContext;
  }
}

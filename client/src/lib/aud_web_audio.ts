// Shared web audio context utility to prevent creating multiple contexts
export const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!window._sharedAudioContext) {
    window._sharedAudioContext = new AudioContextConstructor();
  }
  return window._sharedAudioContext;
};

declare global {
  interface Window {
    _sharedAudioContext: AudioContext;
    webkitAudioContext: typeof AudioContext;
  }
}

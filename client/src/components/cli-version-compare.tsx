import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SplitSquareHorizontal, Play, Pause } from "lucide-react";

export function CliVersionCompareModal({ 
  currentUrl, 
  previousUrl, 
  isVideo = false 
}: { 
  currentUrl: string, 
  previousUrl: string,
  isVideo?: boolean 
}) {
  const [open, setOpen] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const currentVideoRef = useRef<HTMLVideoElement>(null);
  const previousVideoRef = useRef<HTMLVideoElement>(null);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;
    
    // Support both mouse and touch events
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPos(percent);
  };

  const togglePlay = () => {
    if (!isVideo) return;
    
    if (isPlaying) {
      currentVideoRef.current?.pause();
      previousVideoRef.current?.pause();
    } else {
      currentVideoRef.current?.play();
      previousVideoRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Sync videos if one stalls or seeks
  useEffect(() => {
    if (!isVideo || !open) return;
    
    const currentVideo = currentVideoRef.current;
    const previousVideo = previousVideoRef.current;
    
    if (!currentVideo || !previousVideo) return;

    const syncVideos = () => {
      if (Math.abs(currentVideo.currentTime - previousVideo.currentTime) > 0.1) {
        previousVideo.currentTime = currentVideo.currentTime;
      }
    };

    const handlePlay = () => {
      previousVideo.play();
      setIsPlaying(true);
    };

    const handlePause = () => {
      previousVideo.pause();
      setIsPlaying(false);
    };

    currentVideo.addEventListener('timeupdate', syncVideos);
    currentVideo.addEventListener('play', handlePlay);
    currentVideo.addEventListener('pause', handlePause);

    return () => {
      currentVideo.removeEventListener('timeupdate', syncVideos);
      currentVideo.removeEventListener('play', handlePlay);
      currentVideo.removeEventListener('pause', handlePause);
    };
  }, [isVideo, open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-background/50 backdrop-blur">
          <SplitSquareHorizontal size={14} /> Compare Versions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Version Compare</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 relative bg-black rounded-md overflow-hidden mt-2" 
             ref={containerRef}
             onMouseMove={handleMouseMove}
             onTouchMove={handleMouseMove}>
          
          {/* Base Layer (Current) */}
          <div className="absolute inset-0 select-none pointer-events-none">
            {isVideo ? (
              <video 
                ref={currentVideoRef}
                src={currentUrl} 
                className="w-full h-full object-contain"
                muted
                loop
                playsInline
              />
            ) : (
              <img src={currentUrl} alt="Current" className="w-full h-full object-contain" />
            )}
            <div className="absolute bottom-4 right-4 bg-black/60 text-white px-2 py-1 rounded text-xs">
              Current
            </div>
          </div>

          {/* Overlay Layer (Previous) - Clipped by slider */}
          <div 
            className="absolute inset-y-0 left-0 overflow-hidden select-none pointer-events-none"
            style={{ width: `${sliderPos}%` }}
          >
            <div style={{ width: `${sliderPos > 0 ? 10000 / sliderPos : 100}%`, height: '100%' }}>
              {isVideo ? (
                <video 
                  ref={previousVideoRef}
                  src={previousUrl} 
                  className="w-full h-full object-contain"
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img src={previousUrl} alt="Previous" className="w-full h-full object-contain" />
              )}
            </div>
            <div className="absolute bottom-4 left-4 bg-black/60 text-white px-2 py-1 rounded text-xs">
              Previous
            </div>
          </div>

          {/* Slider Divider */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10"
            style={{ left: `calc(${sliderPos}% - 2px)` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-none">
              <div className="w-4 h-4 flex justify-between">
                <div className="w-0.5 h-full bg-gray-400"></div>
                <div className="w-0.5 h-full bg-gray-400"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Video Controls */}
        {isVideo && (
          <div className="pt-4 flex justify-center">
            <Button variant="outline" onClick={togglePlay} className="w-12 h-12 rounded-full p-0">
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
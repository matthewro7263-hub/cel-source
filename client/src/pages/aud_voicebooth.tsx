import { useMemo, useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";

import { GlassButton } from "@/components/ui/glass-button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, ListMusic, Mic, RotateCcw, Save, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Script, AudVoiceTake } from "@shared/schema";

export default function VoiceBooth() {
  const [, params] = useRoute("/projects/:id/voicebooth");
  const projectId = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [selectedScriptId, setSelectedScriptId] = useState<number | null>(null);
  
  // Teleprompter state
  const [textSize, setTextSize] = useState(24);
  const [scrollSpeed, setScrollSpeed] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const chunksRef = useRef<BlobPart[]>([]);
  const scrollIntervalRef = useRef<number>();

  const { data: scripts } = useQuery<Script[]>({
    queryKey: [`/api/projects/${projectId}/scripts`],
  });

  const { data: voiceTakes = [] } = useQuery<AudVoiceTake[]>({
    queryKey: [`/api/projects/${projectId}/aud/voice_takes`],
    enabled: !!projectId,
  });
  
  useEffect(() => {
    if (!selectedScriptId && scripts?.length) setSelectedScriptId(scripts[0].id);
  }, [scripts, selectedScriptId]);

  const selectedScript = useMemo(() => {
    return scripts?.find((script) => script.id === selectedScriptId) || scripts?.[0];
  }, [scripts, selectedScriptId]);

  const scriptText = selectedScript?.content || "No script content found. Add a script to this project to use the teleprompter.";

  useEffect(() => {
    if (!isRecording) return;
    const startedAt = Date.now() - elapsedMs;
    const interval = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (scrollSpeed > 0 && isRecording) {
      scrollIntervalRef.current = window.setInterval(() => {
        if (scrollerRef.current) {
          scrollerRef.current.scrollTop += scrollSpeed;
        }
      }, 50);
    } else {
      clearInterval(scrollIntervalRef.current);
    }
    return () => clearInterval(scrollIntervalRef.current);
  }, [scrollSpeed, isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / bufferLength;
        setLevel(avg / 255);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          setAudioBase64(reader.result as string);
        };

        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        
        // Cleanup stream
        stream.getTracks().forEach(track => track.stop());
        if (audioContextRef.current?.state !== 'closed') {
          audioContextRef.current?.close();
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        setLevel(0);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setElapsedMs(0);
      setAudioURL(null);
      setAudioBase64(null);
    } catch (err) {
      console.error(err);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access to use the voice booth.",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!audioBase64) throw new Error("No audio to save");
      const res = await apiRequest("POST", "/api/aud/voice_takes", {
        projectId,
        audioData: audioBase64
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Take saved successfully" });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/aud/voice_takes`] });
      setAudioURL(null);
      setAudioBase64(null);
    },
    onError: (err: any) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    }
  });

  const resetTeleprompter = () => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  };

  const formattedElapsed = new Date(elapsedMs).toISOString().slice(14, 19);

  return (
      <div className="flex flex-col h-[calc(100vh-5rem)] gap-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold text-foreground">Voice Booth</h1>
          <GlassButton onClick={() => setLocation(`/projects/${projectId}`)}>Back to Project</GlassButton>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Teleprompter Panel */}
          <div className="flex-1 flex flex-col p-4 bg-card border rounded-xl shadow-sm" >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-foreground font-medium">Teleprompter</h2>
                <select
                  className="mt-2 rounded-md border border-white/15 bg-black/45 px-2 py-1 text-xs text-white"
                  value={selectedScriptId ?? ""}
                  onChange={(event) => setSelectedScriptId(Number(event.target.value))}
                >
                  {(scripts || []).map((script) => (
                    <option key={script.id} value={script.id}>{script.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Size</span>
                  <input type="range" min="16" max="72" value={textSize} onChange={e => setTextSize(parseInt(e.target.value))} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Speed</span>
                  <input type="range" min="0" max="10" value={scrollSpeed} onChange={e => setScrollSpeed(parseInt(e.target.value))} />
                </div>
                <GlassButton onClick={resetTeleprompter} className="h-8 px-3 text-xs">
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
                </GlassButton>
              </div>
            </div>
            
            <div 
              ref={scrollerRef}
              className="flex-1 overflow-y-auto whitespace-pre-wrap font-body p-8 bg-black/50 rounded-lg text-white/90 leading-relaxed"
              style={{ fontSize: `${textSize}px` }}
            >
              {scriptText}
            </div>
          </div>

          {/* Recording Panel */}
          <div className="w-80 p-6 flex flex-col items-center justify-center gap-8 bg-card border rounded-xl shadow-sm">
            <div className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-white">
              <span className="flex items-center gap-2 text-xs text-white/55">
                <Clock className="h-4 w-4" /> Take timer
              </span>
              <span className="font-mono text-lg">{formattedElapsed}</span>
            </div>

            {/* Level Meter */}
            <div className="w-full h-8 bg-black/50 rounded-full overflow-hidden relative">
              <div 
                className="absolute left-0 top-0 bottom-0 bg-[#9DD0FF] transition-all duration-75"
                style={{ width: `${level * 100}%` }}
              />
            </div>

            {/* Big Record Button */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                isRecording 
                  ? "bg-red-500 hover:bg-red-600 animate-pulse" 
                  : "bg-[#9DD0FF] hover:bg-[#AED9FF] active:bg-[#87C3FF] active:scale-95"
              }`}
              style={{
                boxShadow: "0 0 0 1.5px rgba(255,255,255,0.95), inset 0 2px 4px rgba(255,255,255,0.3), 0 8px 16px rgba(0,0,0,0.2)"
              }}
            >
              {isRecording ? <Square className="w-12 h-12 text-white" fill="currentColor" /> : <Mic className="w-12 h-12 text-black" />}
            </button>

            {/* Playback & Controls */}
            {audioURL && !isRecording && (
              <div className="w-full flex flex-col gap-4">
                <audio src={audioURL} controls className="w-full" />
                <div className="flex gap-2 w-full">
                  <GlassButton 
                    className="flex-1 flex gap-2 justify-center" 
                    onClick={() => { setAudioURL(null); setAudioBase64(null); }}
                  >
                    <RotateCcw className="w-4 h-4" /> Retake
                  </GlassButton>
                  <GlassButton 
                    className="flex-1 flex gap-2 justify-center bg-[#9DD0FF] text-black hover:bg-[#AED9FF]" 
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="w-4 h-4" /> Save
                  </GlassButton>
                </div>
              </div>
            )}

            <div className="w-full border-t border-white/10 pt-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                <ListMusic className="h-4 w-4" /> Saved takes
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {voiceTakes.length === 0 ? (
                  <p className="text-xs text-white/45">Record and save a take to build an ADR shelf.</p>
                ) : (
                  voiceTakes.slice().reverse().map((take) => (
                    <div key={take.id} className="rounded-lg border border-white/10 bg-black/30 p-2">
                      <div className="mb-1 text-[11px] text-white/50">
                        Take #{take.id} - {take.createdAt ? new Date(take.createdAt).toLocaleString() : "Saved"}
                      </div>
                      <audio src={take.audioData} controls className="w-full" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

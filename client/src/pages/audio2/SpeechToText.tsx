import { useState } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mic, FileAudio, Download, Key } from "lucide-react";

export default function SpeechToText({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultVtt, setResultVtt] = useState<string>("");

  // Note: API key is in-memory only — published sandbox blocks localStorage.
  // User re-enters key each session, or we wire server-side encrypted storage later.

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  };

  const handleTranscribe = async () => {
    if (!file) {
      toast({ title: "Please select an audio file first.", variant: "destructive" });
      return;
    }
    if (!apiKey) {
      toast({ title: "Please provide an OpenAI API key.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "whisper-1");
      formData.append("response_format", "vtt");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || "Failed to transcribe audio");
      }

      const vttText = await res.text();
      setResultVtt(vttText);
      toast({ title: "Transcription successful!" });
    } catch (err: any) {
      toast({ title: "Transcription failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (format: "vtt" | "srt") => {
    if (!resultVtt) return;
    
    let content = resultVtt;
    if (format === "srt") {
      // Very naive conversion from VTT to SRT (Whisper VTT is simple enough for this)
      content = resultVtt
        .replace("WEBVTT\n\n", "")
        .replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, "$1,$2") // replace . with , in timestamps
        .split("\n\n")
        .map((block, i) => `${i + 1}\n${block}`)
        .join("\n\n");
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-${projectId}-captions.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 p-5 border border-white/10 bg-black/40 rounded-lg backdrop-blur-sm mt-8">
      <div className="flex items-center gap-3 mb-2">
        <Mic className="w-6 h-6 text-[#9DD0FF]" />
        <div>
          <h2 className="text-xl font-semibold">Automated Captions (Speech-to-Text)</h2>
          <p className="text-xs text-white/55 mt-1">
            Generate precise VTT/SRT files from audio using OpenAI Whisper.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-white/80">
              <Key className="w-4 h-4" /> OpenAI API Key
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={handleKeyChange}
              placeholder="sk-..."
              className="bg-black/50 border-white/20 text-white font-mono text-sm"
            />
            <p className="text-[10px] text-white/40">Stored locally in your browser.</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-white/80">
              <FileAudio className="w-4 h-4" /> Audio File
            </Label>
            <Input
              type="file"
              accept="audio/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="bg-black/50 border-white/20 text-white text-sm file:bg-[#9DD0FF] file:text-black file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 file:font-semibold"
            />
          </div>

          <GlassButton 
            onClick={handleTranscribe} 
            disabled={isProcessing || !file || !apiKey}
            className="w-full bg-[#9DD0FF]/20 hover:bg-[#9DD0FF]/30 text-[#9DD0FF] border-[#9DD0FF]/50"
          >
            {isProcessing ? "Transcribing..." : "Start Transcription"}
          </GlassButton>
        </div>

        <div className="flex flex-col border border-white/10 rounded-lg bg-black/60 overflow-hidden">
          <div className="bg-white/5 px-3 py-2 border-b border-white/10 flex justify-between items-center text-xs text-white/70">
            <span>Result Preview</span>
            {resultVtt && (
              <div className="flex gap-2">
                <button onClick={() => handleDownload("vtt")} className="flex items-center gap-1 hover:text-white transition-colors">
                  <Download className="w-3 h-3" /> VTT
                </button>
                <button onClick={() => handleDownload("srt")} className="flex items-center gap-1 hover:text-white transition-colors">
                  <Download className="w-3 h-3" /> SRT
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 p-3 overflow-y-auto min-h-[150px] max-h-[250px] font-mono text-xs text-white/80 whitespace-pre-wrap">
            {resultVtt ? resultVtt : <span className="text-white/30 italic">No transcription yet. Output will appear here.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

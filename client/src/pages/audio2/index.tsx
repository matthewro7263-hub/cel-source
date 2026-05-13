import LipSyncStub from "./LipSyncStub";
import CueMarkers from "./CueMarkers";
import SpeechToText from "./SpeechToText";

export default function Audio2Page({ params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10);
  
  if (isNaN(projectId)) {
    return <div className="p-8 text-red-500">Invalid project ID</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Audio Tools</h1>
          <span className="px-2 py-1 rounded bg-white/10 text-xs font-medium text-white/60">Audio2 Namespace</span>
        </div>
        
        <p className="text-white/60 text-sm">
          Experimental audio tools: Lip-sync generation and audio-reactive cues.
        </p>

        <LipSyncStub projectId={projectId} />
        
        <CueMarkers projectId={projectId} />

        <SpeechToText projectId={projectId} />
      </div>
    </div>
  );
}

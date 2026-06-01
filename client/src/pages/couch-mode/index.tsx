import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, MessageSquare, ChevronRight, ChevronLeft, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Panel, Storyboard } from "@shared/schema";

interface StoryboardWithPanels extends Storyboard {
  panels?: Panel[];
}

type ReviewDecision = "approved" | "changes";

interface PanelReviewItem extends Panel {
  storyboardTitle: string;
  panelNumber: number;
}

export default function CouchModePage() {
  const [match, params] = useRoute("/projects/:id/couch");
  const projectId = params?.id ? parseInt(params.id) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentIdx, setCurrentIdx] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  
  const { data: storyboards = [] } = useQuery<StoryboardWithPanels[]>({
    queryKey: [`/api/projects/${projectId}/storyboards`],
    enabled: !!projectId,
  });

  const panels = useMemo<PanelReviewItem[]>(() => {
    return storyboards.flatMap((storyboard) => {
      return [...(storyboard.panels || [])]
        .sort((a, b) => a.orderIdx - b.orderIdx)
        .map((panel, index) => ({
          ...panel,
          storyboardTitle: storyboard.title,
          panelNumber: index + 1,
        }));
    });
  }, [storyboards]);

  // Basic touch handling
  const touchStart = useRef({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") nextPanel();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prevPanel();
      if (e.key === "c") setCommentsOpen(o => !o);
      if (e.key.toLowerCase() === "a") reviewActionMut.mutate("approved");
      if (e.key.toLowerCase() === "r") reviewActionMut.mutate("changes");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panels.length, currentIdx]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 90) {
      if (dx > 0) reviewActionMut.mutate("approved");
      else reviewActionMut.mutate("changes");
      return;
    }

    if (Math.abs(dy) > 50) {
      if (dy < 0) nextPanel(); // swipe up
      else prevPanel(); // swipe down
    }
  };

  const nextPanel = () => {
    if (currentIdx < panels.length - 1) {
      setCurrentIdx(i => i + 1);
      setCommentsOpen(false);
    }
  };
  const prevPanel = () => {
    if (currentIdx > 0) {
      setCurrentIdx(i => i - 1);
      setCommentsOpen(false);
    }
  };

  const panel = panels[currentIdx];

  const reviewActionMut = useMutation({
    mutationFn: async (decision: ReviewDecision) => {
      if (!panel) return null;
      const label = decision === "approved" ? "APPROVED" : "NEEDS REVISION";
      await apiRequest("POST", `/api/projects/${projectId}/comments`, {
        body: `[${panel.storyboardTitle} / Panel ${panel.panelNumber}] ${label}`,
        sceneId: null,
      });
      return decision;
    },
    onSuccess: (decision) => {
      if (!decision) return;
      toast({
        title: decision === "approved" ? "Panel approved" : "Revision note added",
        description: "Saved to project comments.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/comments`] });
      if (currentIdx < panels.length - 1) nextPanel();
    },
  });

  const postCommentMut = useMutation({
    mutationFn: async () => {
      if (!panel) return;
      await apiRequest("POST", `/api/projects/${projectId}/comments`, {
        body: `[${panel.storyboardTitle} / Panel ${panel.panelNumber}] ${newComment}`,
        sceneId: null,
      });
    },
    onSuccess: () => {
      toast({ title: "Comment added" });
      setNewComment("");
      setCommentsOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/comments`] });
    }
  });

  if (!match) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black text-white flex overflow-hidden touch-none select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={() => {
        // play animatic clip if we had logic for it, showing toast for now
        toast({ title: "Playing animatic clip..." });
      }}
    >
      {/* Main Image Area */}
      <div className={`flex-1 relative transition-all duration-300 ${commentsOpen ? 'mr-80 opacity-50' : ''}`}>
        
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10 bg-gradient-to-b from-black/60 to-transparent">
          <div>
            <h2 className="text-xl font-display font-bold">Couch Review</h2>
            <div className="text-white/60 text-sm">
              {panel ? `${panel.storyboardTitle} - panel ${panel.panelNumber}` : "No panels"} - {currentIdx + 1} of {panels.length}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20 rounded-full"
            onClick={() => setLocation(`/projects/${projectId}`)}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {/* Panel Image */}
        {panel ? (
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <img 
              src={panel.imageData || undefined} 
              alt={`${panel.storyboardTitle} panel ${panel.panelNumber}`} 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
              draggable={false}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/40">
            No panels found in this project.
          </div>
        )}
        
        {/* Caption */}
        {panel && (panel.caption || panel.dialogue) && (
          <div className="absolute bottom-28 left-0 right-0 flex justify-center z-10 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md px-8 py-4 rounded-2xl max-w-2xl text-center">
              {panel.dialogue && <div className="font-bold text-lg mb-1">{panel.dialogue}</div>}
              {panel.caption && <div className="text-white/80">{panel.caption}</div>}
            </div>
          </div>
        )}

        {/* Nav controls (invisible mostly, but clickable on desktop) */}
        <div className="absolute inset-y-0 left-0 w-32 flex items-center justify-start p-4 hover:opacity-100 opacity-0 transition-opacity">
          <Button variant="ghost" size="icon" className="w-16 h-16 rounded-full bg-black/40 text-white" onClick={prevPanel}>
            <ChevronLeft className="w-8 h-8" />
          </Button>
        </div>
        <div className="absolute inset-y-0 right-0 w-32 flex items-center justify-end p-4 hover:opacity-100 opacity-0 transition-opacity">
          <Button variant="ghost" size="icon" className="w-16 h-16 rounded-full bg-black/40 text-white" onClick={nextPanel}>
            <ChevronRight className="w-8 h-8" />
          </Button>
        </div>

        {panel && (
          <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full bg-red-500/85 px-6 text-white hover:bg-red-500"
              onClick={() => reviewActionMut.mutate("changes")}
              disabled={reviewActionMut.isPending}
              data-testid="button-couch-reject"
            >
              <XCircle className="mr-2 h-5 w-5" /> Needs revision
            </Button>
            <Button
              size="lg"
              className="rounded-full bg-emerald-400 px-6 text-black hover:bg-emerald-300"
              onClick={() => reviewActionMut.mutate("approved")}
              disabled={reviewActionMut.isPending}
              data-testid="button-couch-approve"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" /> Approve
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full bg-white/15 px-5 text-white hover:bg-white/25"
              onClick={() => setCommentsOpen(true)}
              data-testid="button-couch-comments"
            >
              <MessageSquare className="mr-2 h-5 w-5" /> Comment
            </Button>
          </div>
        )}
      </div>

      {/* Comments Drawer Overlay */}
      <div 
        className={`absolute top-0 right-0 bottom-0 w-96 glass bg-black/40 border-l border-white/10 p-6 flex flex-col transition-transform duration-300 ${commentsOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Comments
          </h3>
          <Button variant="ghost" size="icon" onClick={() => setCommentsOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          <div className="text-sm text-white/60">
            Swipe right to approve, left to request changes. Use C to toggle comments.
          </div>
        </div>

        <div className="space-y-3">
          <Textarea 
            placeholder="Add a comment about this panel..." 
            className="bg-white/10 border-white/20 text-white resize-none"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <Button 
            className="w-full bg-[#9DD0FF] hover:bg-[#AED9FF] text-black"
            disabled={!newComment.trim()}
            onClick={() => postCommentMut.mutate()}
          >
            Post Comment
          </Button>
        </div>
      </div>

      {/* Onboarding hint */}
      {!commentsOpen && currentIdx === 0 && (
        <div className="absolute top-1/2 right-8 -translate-y-1/2 flex items-center gap-4 text-white/50 animate-pulse pointer-events-none">
          <div className="bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">Swipe left for changes</div>
          <ChevronLeft className="w-6 h-6" />
        </div>
      )}
      {!commentsOpen && currentIdx === 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50 animate-pulse pointer-events-none">
          <ChevronLeft className="w-6 h-6 rotate-90" />
          <div className="bg-black/50 px-4 py-2 rounded-full backdrop-blur-md">Swipe up for next panel</div>
        </div>
      )}
    </div>
  );
}

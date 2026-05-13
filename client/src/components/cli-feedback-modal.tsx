import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MessageSquarePlus } from "lucide-react";

export function CliFeedbackModal({ projectId, sceneId, onComplete }: { projectId: number, sceneId?: number, onComplete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [feedback, setFeedback] = useState({
    timing: { needsWork: false, notes: "" },
    characterDesign: { needsWork: false, notes: "" },
    colorLighting: { needsWork: false, notes: "" },
    audioSfx: { needsWork: false, notes: "" },
  });

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", `/api/projects/${projectId}/cli_feedback`, {
        sceneId,
        fields: JSON.stringify(feedback)
      });
      toast({ title: "Feedback submitted successfully" });
      setOpen(false);
      if (onComplete) onComplete();
    } catch (e: any) {
      toast({ title: "Failed to submit feedback", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFeedback = (category: keyof typeof feedback, field: "needsWork" | "notes", value: any) => {
    setFeedback(prev => ({
      ...prev,
      [category]: { ...prev[category], [field]: value }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <MessageSquarePlus size={16} /> Request Revisions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Revisions</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <p className="text-sm text-muted-foreground">Please provide targeted feedback across these specific categories.</p>
          
          <CategoryInput 
            title="Timing & Pacing" 
            data={feedback.timing} 
            onChange={(f, v) => updateFeedback("timing", f, v)} 
          />
          <CategoryInput 
            title="Character & Design" 
            data={feedback.characterDesign} 
            onChange={(f, v) => updateFeedback("characterDesign", f, v)} 
          />
          <CategoryInput 
            title="Color & Lighting" 
            data={feedback.colorLighting} 
            onChange={(f, v) => updateFeedback("colorLighting", f, v)} 
          />
          <CategoryInput 
            title="Audio & SFX" 
            data={feedback.audioSfx} 
            onChange={(f, v) => updateFeedback("audioSfx", f, v)} 
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-[#9DD0FF] hover:bg-[#AED9FF] text-black">
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryInput({ title, data, onChange }: { title: string, data: any, onChange: (field: "needsWork"|"notes", value: any) => void }) {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
      <div className="flex items-center space-x-2">
        <Checkbox 
          id={`check-${title}`} 
          checked={data.needsWork} 
          onCheckedChange={(c) => onChange("needsWork", !!c)} 
        />
        <Label htmlFor={`check-${title}`} className="font-semibold">{title} needs work</Label>
      </div>
      {data.needsWork && (
        <Textarea 
          placeholder={`Add specific notes about ${title.toLowerCase()}...`}
          value={data.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          className="mt-2"
        />
      )}
    </div>
  );
}

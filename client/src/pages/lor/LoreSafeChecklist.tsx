import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

export default function LoreSafeChecklist({ projectId, scriptContent }: { projectId: number, scriptContent: string }) {
  const { data: facts = [] } = useQuery({ queryKey: [`/api/projects/${projectId}/lor_facts`] });
  
  const checkScript = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/lor_check_script`, { scriptContent });
      return res.json();
    }
  });

  if (!scriptContent) return null;

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-semibold text-sm">Lore-Safe Check</h4>
          <p className="text-xs text-muted-foreground">Scans script for continuity compliance</p>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={() => checkScript.mutate()} 
          disabled={checkScript.isPending}
        >
          <RefreshCw size={14} className={`mr-2 ${checkScript.isPending ? "animate-spin" : ""}`} />
          Run Check
        </Button>
      </div>

      {checkScript.data && (
        <div className="space-y-4 text-sm mt-4 border-t pt-4">
          <div>
            <h5 className="font-medium flex items-center text-green-600 mb-2">
              <CheckCircle2 size={14} className="mr-1.5" /> 
              Recognized Entities ({checkScript.data.matchedEntities.length})
            </h5>
            <div className="flex flex-wrap gap-1">
              {checkScript.data.matchedEntities.map((e: any) => (
                <span key={e.id} className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-xs">
                  {e.title}
                </span>
              ))}
              {checkScript.data.matchedEntities.length === 0 && <span className="text-muted-foreground text-xs italic">None found</span>}
            </div>
          </div>

          <div>
            <h5 className="font-medium flex items-center text-yellow-600 mb-2">
              <AlertTriangle size={14} className="mr-1.5" /> 
              Unknown Proper Nouns ({checkScript.data.unrecognizedWords.length})
            </h5>
            <p className="text-xs text-muted-foreground mb-2 leading-tight">These capitalized words aren't in your continuity tracker. If they are new characters/props, add them to the Continuity tab.</p>
            <div className="flex flex-wrap gap-1">
              {checkScript.data.unrecognizedWords.map((w: string, i: number) => (
                <span key={i} className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-700">
                  {w}
                </span>
              ))}
              {checkScript.data.unrecognizedWords.length === 0 && <span className="text-muted-foreground text-xs italic">All clear</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

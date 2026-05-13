import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MetalGlassButton } from "@/components/ui/metal-glass-button";
import { GlassButton } from "@/components/ui/glass-button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Lock, Droplets, Unlock } from "lucide-react";

interface ApprovalSignoff {
  id: number;
  projectId: number;
  milestone: string;
  status: string;
  approverName: string | null;
  signature: string | null;
  signatureHash: string | null;
  notes: string | null;
  approvedAt: string | null;
  createdAt: string;
}

const MILESTONE_LABELS: Record<string, string> = {
  storyboard: "Approve Sketch",
  animatic: "Approve Animatic",
  final: "Approve Final",
};

const MILESTONE_DESCRIPTIONS: Record<string, string> = {
  storyboard: "Review and sign off on the sketch boards, staging, and shot composition.",
  animatic: "Review and sign off on the animatic timing and motion.",
  final: "Final approval — review the completed animation for delivery.",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-medium">
        <CheckCircle2 size={11} className="mr-1" /> Approved
      </Badge>
    );
  }
  if (status === "changes-requested") {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-medium">
        Changes Requested
      </Badge>
    );
  }
  return (
    <Badge className="bg-muted text-muted-foreground border-border font-medium">
      Pending
    </Badge>
  );
}

function PreviewStatus({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
        <Unlock size={11} />
        Preview: <span className="font-bold tracking-wider">UNLOCKED</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
      <Droplets size={11} />
      Preview: <span className="font-bold tracking-wider opacity-60">WATERMARKED</span>
    </div>
  );
}

function MilestoneCard({
  record,
  projectId,
  index,
}: {
  record: ApprovalSignoff;
  projectId: number;
  index: number;
}) {
  const { toast } = useToast();
  const isApproved = record.status === "approved";

  const [approverName, setApproverName] = useState(record.approverName ?? "");
  const [signature, setSignature] = useState(record.signature ?? "");
  const [notes, setNotes] = useState(record.notes ?? "");

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<ApprovalSignoff>) => {
      const res = await apiRequest("PUT", `/api/approvals/${record.id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "approvals"] });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleApprove = () => {
    if (!signature.trim()) {
      toast({ title: "Signature required", description: "Type your full name to sign.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      status: "approved",
      approverName: approverName.trim() || null,
      signature: signature.trim(),
      notes: notes.trim() || null,
    } as any);
    toast({ title: "Approved!", description: `${MILESTONE_LABELS[record.milestone]} has been signed off.` });
  };

  const handleRequestChanges = () => {
    updateMutation.mutate({
      status: "changes-requested",
      approverName: approverName.trim() || null,
      notes: notes.trim() || null,
    } as any);
    toast({ title: "Changes requested", description: "The milestone has been marked for revision." });
  };

  return (
    <Card
      data-testid={`card-milestone-${record.milestone}`}
      className={`relative border transition-all ${
        isApproved
          ? "border-emerald-500/30 bg-emerald-950/10"
          : "border-card-border bg-card"
      }`}
    >
      {isApproved && (
        <div className="absolute top-3 right-3 text-emerald-400">
          <Lock size={14} />
        </div>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">
              Milestone {index + 1}
            </div>
            <CardTitle className="text-base font-semibold">
              {MILESTONE_LABELS[record.milestone] ?? record.milestone}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {MILESTONE_DESCRIPTIONS[record.milestone]}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={record.status} />
            <PreviewStatus status={record.status} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isApproved ? (
          /* Locked — read-only approved state */
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 size={16} />
              Signed off
            </div>
            {record.signature && (
              <p
                className="font-['Cursive',_'Georgia',_serif] text-xl text-foreground/80 italic"
                data-testid={`text-signature-${record.milestone}`}
              >
                {record.signature}
              </p>
            )}
            {record.approverName && (
              <p className="text-xs text-muted-foreground">By: {record.approverName}</p>
            )}
            {record.approvedAt && (
              <p className="text-xs text-muted-foreground" data-testid={`text-approvedat-${record.milestone}`}>
                {new Date(record.approvedAt).toLocaleString()}
              </p>
            )}
            {record.signatureHash && (
              <p
                className="rounded-md border border-emerald-500/20 bg-background/70 px-2 py-1 font-mono text-[11px] text-emerald-500"
                data-testid={`text-signature-hash-${record.milestone}`}
              >
                Receipt {record.signatureHash}
              </p>
            )}
            {record.notes && (
              <p className="text-xs text-muted-foreground border-t border-border/50 pt-2 mt-2">
                Notes: {record.notes}
              </p>
            )}
          </div>
        ) : (
          /* Active — editable sign-off form */
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`approver-${record.id}`} className="text-xs">
                  Approver name (optional)
                </Label>
                <Input
                  id={`approver-${record.id}`}
                  data-testid={`input-approver-${record.milestone}`}
                  placeholder="Your name"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  disabled={updateMutation.isPending}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`sig-${record.id}`} className="text-xs font-medium">
                  Typed signature <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`sig-${record.id}`}
                  data-testid={`input-signature-${record.milestone}`}
                  placeholder="Type your full name to sign"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  disabled={updateMutation.isPending}
                  className="h-8 text-sm font-['Cursive',_'Georgia',_serif] italic"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`notes-${record.id}`} className="text-xs">
                Notes
              </Label>
              <Textarea
                id={`notes-${record.id}`}
                data-testid={`textarea-notes-${record.milestone}`}
                placeholder="Any notes or feedback…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={updateMutation.isPending}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <MetalGlassButton
                variant="primary"
                noMetal
                data-testid={`button-approve-${record.milestone}`}
                onClick={handleApprove}
                disabled={updateMutation.isPending}
                className="bg-[#9DD0FF] text-black hover:bg-[#AED9FF] text-sm h-8"
              >
                <CheckCircle2 size={14} className="mr-1.5" />
                {MILESTONE_LABELS[record.milestone] ?? "Approve"}
              </MetalGlassButton>

              <GlassButton
                variant="ghost"
                data-testid={`button-request-changes-${record.milestone}`}
                onClick={handleRequestChanges}
                disabled={updateMutation.isPending}
                className="text-sm h-8"
              >
                Request Changes
              </GlassButton>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SignOffPanel({ projectId }: { projectId: number }) {
  const { data: signoffs, isLoading } = useQuery<ApprovalSignoff[]>({
    queryKey: ["/api/projects", projectId, "approvals"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/approvals`);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!signoffs || signoffs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">
        No sign-off milestones found.
      </div>
    );
  }

  const approvedCount = signoffs.filter((s) => s.status === "approved").length;

  return (
    <div className="space-y-5" data-testid="signoff-panel">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-base">Sign-off Milestones</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {approvedCount} of {signoffs.length} milestones approved
          </p>
        </div>
        <div className="flex gap-1">
          {signoffs.map((s) => (
            <div
              key={s.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                s.status === "approved"
                  ? "bg-emerald-400"
                  : s.status === "changes-requested"
                  ? "bg-amber-400"
                  : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {signoffs.map((record, i) => (
          <MilestoneCard
            key={record.id}
            record={record}
            projectId={projectId}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

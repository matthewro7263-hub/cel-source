import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GlassButton } from "@/components/ui/glass-button";
import { DataSurface, DataWorkspace } from "@/components/layout/data-workspace";
import { Copy, ExternalLink, Check, Calendar, DollarSign, User, Mail, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// v4 commission invoice
import { CommissionLineItemsEditor } from "@/components/commission-invoice";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  quoted: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  accepted: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "in-progress": "bg-violet-500/15 text-violet-400 border-violet-500/20",
  delivered: "bg-teal-500/15 text-teal-400 border-teal-500/20",
  declined: "bg-red-500/15 text-red-400 border-red-500/20",
};

const STATUS_ORDER = ["new", "quoted", "accepted", "in-progress", "delivered", "declined"];
const STATUS_LABELS: Record<string, string> = {
  new: "New",
  quoted: "Quoted",
  accepted: "Accepted",
  "in-progress": "In Progress",
  delivered: "Delivered",
  declined: "Declined",
};

type CommissionSummary = {
  id: number;
  ownerUserId: number;
  clientName: string;
  clientEmail: string;
  type: string;
  description: string;
  deadline: string | null;
  budgetRange: string;
  status: string;
  notes: string;
  hasReferenceImage: boolean;
  linkedProjectId: number | null;
  createdAt: string;
};

type CommissionDetail = CommissionSummary & { referenceImage: string | null };

export default function CommissionsQueue() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: list, isLoading } = useQuery<CommissionSummary[]>({
    queryKey: ["/api/commissions"],
  });

  const { data: detail } = useQuery<CommissionDetail>({
    queryKey: ["/api/commissions", selected],
    enabled: selected !== null,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/commissions/${selected}`);
      return r.json();
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: { status?: string; notes?: string } }) =>
      (await apiRequest("PATCH", `/api/commissions/${id}`, patch)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commissions"] });
      if (selected) queryClient.invalidateQueries({ queryKey: ["/api/commissions", selected] });
    },
  });

  const convert = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("POST", `/api/commissions/${id}/convert`)).json(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/commissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (selected) queryClient.invalidateQueries({ queryKey: ["/api/commissions", selected] });
      toast({ title: "Project created!", description: `"${data.project.title}" is now in your projects.` });
    },
    onError: (err: any) => toast({ title: "Failed", description: String(err.message || err), variant: "destructive" }),
  });

  const intakeUrl = user
    ? `${window.location.origin}${window.location.pathname}#/commission/${user.id}`
    : "";

  const copyIntakeUrl = () => {
    navigator.clipboard.writeText(intakeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <DataWorkspace
        title="Commissions"
        icon={<DollarSign size={20} className="text-primary" />}
        description="Manage incoming commission work, intake links, and conversion into project spaces."
      >
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
      </DataWorkspace>
    );
  }

  const statusCounts = STATUS_ORDER.reduce<Record<string, number>>((acc, status) => {
    acc[status] = list?.filter((commission) => commission.status === status).length ?? 0;
    return acc;
  }, {});
  const linkedProjects = list?.filter((commission) => commission.linkedProjectId !== null).length ?? 0;

  return (
    <DataWorkspace
      title="Commissions"
      icon={<DollarSign size={20} className="text-primary" />}
      description="Manage incoming commission work, intake links, and conversion into project spaces."
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={copyIntakeUrl}
            className="gap-1.5"
            data-testid="button-copy-intake-url"
          >
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy link"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={`#/commission/${user?.id}`} target="_blank" rel="noopener noreferrer" data-testid="link-preview-intake">
              <ExternalLink size={13} />
            </a>
          </Button>
        </>
      }
      summary={
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QueueStat label="New" value={String(statusCounts.new ?? 0)} detail="Fresh intake requests" />
          <QueueStat label="Quoted" value={String(statusCounts.quoted ?? 0)} detail="Waiting on approval" />
          <QueueStat label="In progress" value={String(statusCounts["in-progress"] ?? 0)} detail="Active commission work" />
          <QueueStat label="Linked projects" value={String(linkedProjects)} detail="Converted into project spaces" />
        </div>
      }
    >
      {!list || list.length === 0 ? (
        <DataSurface className="border-dashed py-16 text-center">
          {/* Branded illustration - empty queue */}
          <div className="mx-auto mb-4">
            <svg width="120" height="120" viewBox="0 0 120 120" className="opacity-70">
              <defs>
                <linearGradient id="emptyCommissionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD9A8" />
                  <stop offset="50%" stopColor="#C4B5FD" />
                  <stop offset="100%" stopColor="#9DD0FF" />
                </linearGradient>
              </defs>
              {/* Queue cards */}
              <rect x="15" y="20" width="90" height="25" rx="4" fill="none" stroke="url(#emptyCommissionGradient)" strokeWidth="1.5" opacity="0.4" />
              <rect x="15" y="50" width="90" height="25" rx="4" fill="none" stroke="url(#emptyCommissionGradient)" strokeWidth="1.5" opacity="0.5" />
              <rect x="15" y="80" width="90" height="25" rx="4" fill="none" stroke="url(#emptyCommissionGradient)" strokeWidth="1.5" opacity="0.6" />
              {/* Plus sign */}
              <circle cx="60" cy="62" r="12" fill="url(#emptyCommissionGradient)" opacity="0.2" />
              <line x1="60" y1="56" x2="60" y2="68" stroke="url(#emptyCommissionGradient)" strokeWidth="2" strokeLinecap="round" />
              <line x1="54" y1="62" x2="66" y2="62" stroke="url(#emptyCommissionGradient)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="mb-1.5 font-display font-semibold">No commissions yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">Share your intake link and commissions will appear here.</p>
          <Button variant="outline" onClick={copyIntakeUrl}>
            <Copy size={13} className="mr-1.5" /> Copy intake URL
          </Button>
        </DataSurface>
      ) : (
        <DataSurface className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="text-left px-4 py-2.5 font-medium">Client</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Budget</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Deadline</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    data-testid={`row-commission-${c.id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.clientName}</div>
                      <div className="text-xs text-muted-foreground">{c.clientEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.type}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.budgetRange}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${STATUS_COLORS[c.status] || "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {c.deadline || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <GlassButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelected(c.id)}
                        data-testid={`button-view-commission-${c.id}`}
                      >
                        View
                      </GlassButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataSurface>
      )}

      {/* Detail dialog */}
      <CommissionDetailDialog
        commission={detail || null}
        open={selected !== null}
        onClose={() => setSelected(null)}
        onUpdate={(patch) => selected && update.mutate({ id: selected, patch })}
        onConvert={() => selected && convert.mutate(selected)}
        converting={convert.isPending}
      />
    </DataWorkspace>
  );
}

function QueueStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/84 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function CommissionDetailDialog({
  commission,
  open,
  onClose,
  onUpdate,
  onConvert,
  converting,
}: {
  commission: CommissionDetail | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (patch: { status?: string; notes?: string }) => void;
  onConvert: () => void;
  converting: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (commission) {
      setNotes(commission.notes || "");
      setStatus(commission.status);
    }
  }, [commission?.id]);

  if (!commission) return null;

  const saveNotes = useCallback(() => {
    onUpdate({ notes });
  }, [notes, onUpdate]);

  const handleStatusChange = (v: string) => {
    setStatus(v);
    onUpdate({ status: v });
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Commission — {commission.clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Client info */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/40">
            <div className="flex items-center gap-2 text-sm">
              <User size={14} className="text-muted-foreground shrink-0" />
              <span>{commission.clientName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail size={14} className="text-muted-foreground shrink-0" />
              <span className="truncate">{commission.clientEmail}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign size={14} className="text-muted-foreground shrink-0" />
              <span>{commission.budgetRange}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-muted-foreground shrink-0" />
              <span>{commission.deadline || "No deadline"}</span>
            </div>
          </div>

          {/* Type */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Type</Label>
            <p className="mt-1 text-sm font-medium">{commission.type}</p>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description</Label>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground/80 bg-muted/30 rounded-lg p-3">
              {commission.description}
            </p>
          </div>

          {/* Reference image */}
          {commission.referenceImage && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Reference</Label>
              <img
                src={commission.referenceImage}
                alt="Reference"
                className="max-h-48 rounded-lg border border-border object-contain"
              />
            </div>
          )}

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-44" data-testid="select-commission-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Artist notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Private notes (not visible to client)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={3}
              placeholder="Internal notes, quotes, follow-ups…"
              data-testid="textarea-commission-notes"
            />
          </div>

          {/* Convert to project */}
          {!commission.linkedProjectId && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Create a project from this</div>
                <div className="text-xs text-muted-foreground">Auto-fills title, description, and deadline.</div>
              </div>
              <GlassButton
                variant="primary"
                size="sm"
                onClick={onConvert}
                disabled={converting}
                data-testid="button-convert-commission"
              >
                <FolderOpen size={13} className="mr-1.5" />
                {converting ? "Creating…" : "Create project"}
              </GlassButton>
            </div>
          )}

          {commission.linkedProjectId && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Check size={14} />
              Linked to project #{commission.linkedProjectId}
            </div>
          )}

          {/* v4: line items + invoice */}
          <CommissionLineItemsEditor
            commissionId={commission.id}
            clientName={commission.clientName}
            clientEmail={commission.clientEmail}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

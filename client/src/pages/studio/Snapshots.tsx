import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, GitBranch, Plus, RotateCcw, Trash2, ChevronRight } from "lucide-react";

interface Snapshot {
  id: number;
  projectId: number;
  label: string;
  parentId: number | null;
  notes: string | null;
  restoredFromId: number | null;
  createdAt: string;
}

function buildTree(snapshots: Snapshot[]): Map<number | null, Snapshot[]> {
  const tree = new Map<number | null, Snapshot[]>();
  for (const s of snapshots) {
    const key = s.parentId ?? null;
    if (!tree.has(key)) tree.set(key, []);
    tree.get(key)!.push(s);
  }
  return tree;
}

function SnapshotNode({
  snap,
  depth,
  tree,
  onRestore,
  onDelete,
}: {
  snap: Snapshot;
  depth: number;
  tree: Map<number | null, Snapshot[]>;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const children = tree.get(snap.id) ?? [];

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div
        className={`flex items-start gap-2 p-3 rounded-lg mb-1.5 transition-colors ${
          snap.restoredFromId ? "bg-amber-500/10 border border-amber-500/20" : "bg-muted/40 hover:bg-muted/60"
        }`}
        data-testid={`row-snapshot-${snap.id}`}
      >
        {depth > 0 && (
          <ChevronRight size={13} className="mt-1 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{snap.label}</span>
            {snap.restoredFromId && (
              <span className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded">
                Restore Log
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              #{snap.id} · {new Date(snap.createdAt).toLocaleString()}
            </span>
          </div>
          {snap.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{snap.notes}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {!snap.restoredFromId && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onRestore(snap.id)}
              data-testid={`button-restore-snapshot-${snap.id}`}
            >
              <RotateCcw size={11} className="mr-1" /> Restore
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(snap.id)}
            data-testid={`button-delete-snapshot-${snap.id}`}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
      {children.map((child) => (
        <SnapshotNode
          key={child.id}
          snap={child}
          depth={depth + 1}
          tree={tree}
          onRestore={onRestore}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default function Snapshots() {
  const params = useParams() as { id: string };
  const projectId = parseInt(params.id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [newLabel, setNewLabel] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const { data: snapshots = [], isLoading } = useQuery<Snapshot[]>({
    queryKey: ["/api/projects", projectId, "studio/snapshots"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/studio/snapshots`);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { label: string; parentId: number | null; notes: string | null }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/studio/snapshots`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "studio/snapshots"] });
      setNewLabel("");
      setNewParentId("");
      setNewNotes("");
      toast({ title: "Snapshot taken" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (snapId: number) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/studio/snapshots/${snapId}/restore`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "studio/snapshots"] });
      toast({ title: "Restore logged", description: "A restore-intent log entry was created." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (snapId: number) => {
      const res = await apiRequest("DELETE", `/api/projects/${projectId}/studio/snapshots/${snapId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "studio/snapshots"] });
    },
  });

  const handleTakeSnapshot = () => {
    if (!newLabel.trim()) {
      toast({ title: "Enter a snapshot label", variant: "destructive" });
      return;
    }
    const parentId = newParentId ? parseInt(newParentId, 10) : null;
    createMutation.mutate({
      label: newLabel.trim(),
      parentId: isNaN(parentId!) ? null : parentId,
      notes: newNotes.trim() || null,
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const tree = buildTree(snapshots);
  const roots = tree.get(null) ?? [];

  return (
    <div className="px-5 sm:px-6 lg:px-10 py-7 lg:py-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(`/projects/${projectId}`)}
          data-testid="button-back"
        >
          <ArrowLeft size={16} className="mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <GitBranch size={20} className="text-primary" />
          <h1 className="text-xl font-bold font-display">Branching Snapshots</h1>
        </div>
        <span className="text-sm text-muted-foreground ml-1">({snapshots.length})</span>
      </div>

      {/* Take snapshot form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Take Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Label *</Label>
            <Input
              placeholder="e.g. v1.0 — Scene 3 complete"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              data-testid="input-snapshot-label"
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            <div>
              <Label className="text-xs mb-1 block">Parent Snapshot ID (optional)</Label>
              <Input
                type="number"
                placeholder="None"
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
                className="w-36"
                data-testid="input-snapshot-parent"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Notes (optional)</Label>
            <Textarea
              placeholder="What changed in this snapshot…"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              rows={2}
              data-testid="input-snapshot-notes"
            />
          </div>
          <Button
            onClick={handleTakeSnapshot}
            disabled={createMutation.isPending}
            data-testid="button-take-snapshot"
          >
            <Plus size={14} className="mr-1" /> Take Snapshot
          </Button>
        </CardContent>
      </Card>

      {/* Snapshot tree */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Snapshot Tree</CardTitle>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots yet. Take one to get started.</p>
          ) : roots.length === 0 ? (
            // All snapshots have parents — show flat list
            <div className="space-y-1">
              {snapshots.map((snap) => (
                <SnapshotNode
                  key={snap.id}
                  snap={snap}
                  depth={0}
                  tree={tree}
                  onRestore={restoreMutation.mutate}
                  onDelete={deleteMutation.mutate}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {roots.map((snap) => (
                <SnapshotNode
                  key={snap.id}
                  snap={snap}
                  depth={0}
                  tree={tree}
                  onRestore={restoreMutation.mutate}
                  onDelete={deleteMutation.mutate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

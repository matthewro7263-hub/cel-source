import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, Trash2, Undo } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Script, Scene, Asset, Panel } from "@shared/schema";

export default function BakTrashPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: trashItems, isLoading } = useQuery<{ scripts: Script[]; scenes: Scene[]; assets: Asset[]; panels: Panel[] }>({
    queryKey: [`/api/projects/${id}/trash`],
  });

  const { data: integrity, refetch: runIntegrity, isFetching: scanning } = useQuery<{ checkedAt: string; ok: boolean; counts: { total: number; ok: number; missing: number; corrupt: number }; items: { kind: string; id: number; name: string | null; deletedAt: string | null; status: "ok" | "missing" | "corrupt"; sha256: string | null; bytes: number; message?: string }[] }>({
    queryKey: [`/api/projects/${id}/trash/integrity`],
    enabled: false,
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ kind, itemId }: { kind: string, itemId: number }) => {
      await apiRequest("POST", `/api/trash/restore/${kind}/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/trash`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}`] });
      toast({ title: "Item restored successfully" });
    }
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async ({ kind, itemId }: { kind: string, itemId: number }) => {
      await apiRequest("DELETE", `/api/trash/permanent/${kind}/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/trash`] });
      toast({ title: "Item permanently deleted" });
    }
  });

  if (isLoading) return <div>Loading trash...</div>;

  const hasItems = ((trashItems?.scripts?.length ?? 0) > 0) ||
                   ((trashItems?.scenes?.length ?? 0) > 0) ||
                   ((trashItems?.assets?.length ?? 0) > 0) ||
                   ((trashItems?.panels?.length ?? 0) > 0);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href={`/projects/${id}`}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-display font-bold">Trash Recovery</h1>
        </div>
        <Button variant="outline" onClick={() => runIntegrity()} disabled={scanning} data-testid="button-integrity-scan">
          <ShieldCheck className="mr-2 h-4 w-4" /> {scanning ? "Scanning..." : "Run Integrity Scan"}
        </Button>
      </div>

      {integrity && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">Asset Integrity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Total</div><div className="font-semibold">{integrity.counts.total}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">OK</div><div className="font-semibold text-emerald-600">{integrity.counts.ok}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Missing</div><div className="font-semibold text-amber-600">{integrity.counts.missing}</div></div>
              <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Corrupt</div><div className="font-semibold text-destructive">{integrity.counts.corrupt}</div></div>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border">
              {integrity.items.map((item: { kind: string; id: number; name: string | null; deletedAt: string | null; status: "ok" | "missing" | "corrupt"; sha256: string | null; bytes: number; message?: string }) => (
                <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 border-b px-3 py-2 text-xs last:border-b-0">
                  <span className="font-medium">{item.kind} #{item.id} - {item.name}</span>
                  <span className={item.status === "ok" ? "text-emerald-600" : "text-destructive"}>
                    {item.status}{item.sha256 ? ` - ${item.sha256.slice(0, 12)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!hasItems ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Trash is empty.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {trashItems?.scripts && trashItems.scripts.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Scripts</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {trashItems?.scripts?.map((s: Script) => (
                  <div key={s.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <span>{s.title || "Untitled"}</span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => restoreMutation.mutate({ kind: 'script', itemId: s.id })}>
                        <Undo className="w-4 h-4 mr-2" /> Restore
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => permanentDeleteMutation.mutate({ kind: 'script', itemId: s.id })}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {trashItems?.scenes && trashItems.scenes.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Scenes</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {trashItems?.scenes?.map((s: Scene) => (
                  <div key={s.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <span>Scene {s.number}: {s.title}</span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => restoreMutation.mutate({ kind: 'scene', itemId: s.id })}>
                        <Undo className="w-4 h-4 mr-2" /> Restore
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => permanentDeleteMutation.mutate({ kind: 'scene', itemId: s.id })}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {trashItems?.assets && trashItems.assets.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Assets</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {trashItems?.assets?.map((a: Asset) => (
                  <div key={a.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <span>{a.filename}</span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => restoreMutation.mutate({ kind: 'asset', itemId: a.id })}>
                        <Undo className="w-4 h-4 mr-2" /> Restore
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => permanentDeleteMutation.mutate({ kind: 'asset', itemId: a.id })}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {trashItems?.panels && trashItems.panels.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Storyboard Panels</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {trashItems?.panels?.map((p: Panel) => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <span>Panel #{p.id}</span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => restoreMutation.mutate({ kind: 'panel', itemId: p.id })}>
                        <Undo className="w-4 h-4 mr-2" /> Restore
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => permanentDeleteMutation.mutate({ kind: 'panel', itemId: p.id })}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

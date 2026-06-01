import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { FileText } from "lucide-react";

export default function CastingTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();

  const { data: scenes = [] as any[] } = useQuery<any[]>({ queryKey: [`/api/projects/${projectId}/scenes`] });
  const { data: facts = [] as any[] } = useQuery<any[]>({ queryKey: [`/api/projects/${projectId}/lor_facts`] });
  const { data: matrix = [] as any[], isLoading } = useQuery<any[]>({ queryKey: [`/api/projects/${projectId}/lor_casting`] });

  const toggleCasting = useMutation({
    mutationFn: async ({ sceneId, entityId, present }: any) => {
      await apiRequest("POST", `/api/projects/${projectId}/lor_casting/toggle`, { sceneId, entityId, present });
    },
    onMutate: async (newCast) => {
      await queryClient.cancelQueries({ queryKey: [`/api/projects/${projectId}/lor_casting`] });
      const prev = (queryClient.getQueryData([`/api/projects/${projectId}/lor_casting`]) as any[] | undefined) ?? [];

      const exists = prev.some((m) => m.sceneId === newCast.sceneId && m.entityId === newCast.entityId);
      const newMatrix = exists
        ? prev.map((m) =>
            m.sceneId === newCast.sceneId && m.entityId === newCast.entityId
              ? { ...m, present: newCast.present }
              : m,
          )
        : [...prev, { projectId, sceneId: newCast.sceneId, entityId: newCast.entityId, present: newCast.present }];

      queryClient.setQueryData([`/api/projects/${projectId}/lor_casting`], newMatrix);
      return { prev };
    },
    onError: (err, newCast, context) => {
      if (context?.prev) {
        queryClient.setQueryData([`/api/projects/${projectId}/lor_casting`], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/lor_casting`] });
    }
  });

  // Filter facts to just castable entities
  const entities = useMemo(() => facts.filter((f: any) => f.category === 'character' || f.category === 'prop' || f.category === 'location'), [facts]);
  
  if (isLoading) return <div className="text-center p-8">Loading matrix...</div>;

  if (entities.length === 0 || scenes.length === 0) {
    return (
      <div className="bg-card p-8 rounded-lg border text-center text-muted-foreground">
        <FileText className="mx-auto mb-4 opacity-50" size={32} />
        <p>You need scenes and continuity entities (characters, props, locations) to use the Casting Matrix.</p>
      </div>
    );
  }

  // Calculate usage counts
  const usageCounts = entities.map((e: any) => {
    return matrix.filter((m: any) => m.entityId === e.id && m.present).length;
  });

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-card border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] sticky left-0 bg-card z-20">Scene</TableHead>
              {entities.map((e: any) => (
                <TableHead key={e.id} className="text-center min-w-[100px] border-l">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-normal text-muted-foreground mb-1">{e.category}</span>
                    <span className="font-semibold text-foreground truncate w-full px-2" title={e.title}>{e.title}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {scenes.map((scene: any) => (
              <TableRow key={scene.id}>
                <TableCell className="font-medium sticky left-0 bg-card z-10 shadow-[1px_0_0_0_hsl(var(--border))]">
                  <span className="font-mono">{scene.number}</span>. {scene.title}
                </TableCell>
                {entities.map((e: any) => {
                  const isPresent = matrix.find((m: any) => m.sceneId === scene.id && m.entityId === e.id)?.present || false;
                  return (
                    <TableCell key={e.id} className="text-center border-l bg-card/50">
                      <Checkbox 
                        checked={isPresent} 
                        onCheckedChange={(checked) => toggleCasting.mutate({ sceneId: scene.id, entityId: e.id, present: !!checked })}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-medium">
              <TableCell className="sticky left-0 bg-muted/50 z-10 shadow-[1px_0_0_0_hsl(var(--border))] text-right">
                Total Uses
              </TableCell>
              {entities.map((e: any, idx: number) => (
                <TableCell key={e.id} className="text-center border-l">
                  {usageCounts[idx] === 1 ? (
                    <Badge variant="destructive" className="bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30 border-yellow-500/50">Single Use</Badge>
                  ) : usageCounts[idx] > 0 ? (
                    <span>{usageCounts[idx]}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">
        Track which assets are needed per scene. Single-use assets are highlighted in yellow to help you identify expensive one-offs.
      </p>
    </div>
  );
}

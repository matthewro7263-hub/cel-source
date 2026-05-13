import { useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, CheckCircle2, MapPin, Package, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LorFact {
  id: number;
  projectId: number;
  category: string;
  title: string;
  body: string;
  imageData: string | null;
  createdAt: string;
}

interface LoreCheckResult {
  matchedEntities: LorFact[];
  unrecognizedWords: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  character: "Character",
  prop: "Prop",
  location: "Location",
  rule: "Rule",
};

function extractHeight(body: string): string {
  const labeled = body.match(/height\s*:\s*([^.\n]+)/i);
  if (labeled?.[1]) return labeled[1].trim();
  const loose = body.match(/~?\d+(?:\.\d+)?\s*(?:cm|m|ft|in|["'])/i);
  return loose?.[0] ?? "Not set";
}

function splitFacts(facts: LorFact[]) {
  return {
    characters: facts.filter((fact) => fact.category === "character"),
    locations: facts.filter((fact) => fact.category === "location"),
    props: facts.filter((fact) => fact.category === "prop"),
    rules: facts.filter((fact) => fact.category === "rule"),
  };
}

function FactList({ facts, empty }: { facts: LorFact[]; empty: string }) {
  if (facts.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="space-y-3">
      {facts.map((fact) => (
        <div key={fact.id} className="rounded-lg border border-card-border bg-card/70 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">{fact.title}</h3>
            <Badge variant="outline">{CATEGORY_LABELS[fact.category] ?? fact.category}</Badge>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{fact.body || "No notes yet."}</p>
        </div>
      ))}
    </div>
  );
}

export default function EpisodeBible() {
  const [, params] = useRoute("/projects/:id/bible");
  const projectId = Number(params?.id ?? 0);
  const { toast } = useToast();
  const [checkText, setCheckText] = useState("");

  const { data: facts = [], isLoading } = useQuery<LorFact[]>({
    queryKey: [`/api/projects/${projectId}/lor_facts`],
    enabled: projectId > 0,
  });

  const grouped = useMemo(() => splitFacts(facts), [facts]);

  const seedBible = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${projectId}/lor_seed_bible`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/lor_facts`] });
      toast({ title: "Episode bible seeded" });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't seed bible", description: error.message, variant: "destructive" });
    },
  });

  const loreCheck = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/lor_check_script`, {
        scriptContent: checkText,
      });
      return res.json() as Promise<LoreCheckResult>;
    },
  });

  return (
    <div className="px-5 sm:px-6 lg:px-10 py-7 lg:py-10 max-w-6xl mx-auto">
      <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link href={`/projects/${projectId}`}>
            <Button variant="ghost" size="sm" className="-ml-2 mb-3" data-testid="link-back-project">
              <ArrowLeft size={14} className="mr-1.5" /> Project
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            <BookOpen size={14} className="text-primary" />
            Episode bible
          </div>
          <h1 className="font-display text-xl font-bold tracking-tight">Continuity Command Center</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Keep character scale, locations, props, and show rules in one production-ready reference.
          </p>
        </div>
        <Button
          className="bg-[#9DD0FF] text-black hover:bg-[#AED9FF]"
          onClick={() => seedBible.mutate()}
          disabled={seedBible.isPending}
          data-testid="button-seed-bible"
        >
          <Sparkles size={15} className="mr-1.5" />
          {seedBible.isPending ? "Seeding..." : "Seed Starter Bible"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-48 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <section className="rounded-xl border border-card-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  <h2 className="font-display font-semibold">Character Height Table</h2>
                </div>
                <Badge variant="outline">{grouped.characters.length} characters</Badge>
              </div>

              {grouped.characters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No character facts yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Character</th>
                        <th className="py-2 pr-4 font-medium">Height</th>
                        <th className="py-2 font-medium">Continuity Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grouped.characters.map((fact) => (
                        <tr key={fact.id} className="border-b border-border/50 last:border-0">
                          <td className="py-3 pr-4 font-medium">{fact.title}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{extractHeight(fact.body)}</td>
                          <td className="py-3 text-muted-foreground">{fact.body}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-card-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <MapPin size={16} className="text-primary" />
                <h2 className="font-display font-semibold">Location Continuity</h2>
              </div>
              <FactList facts={grouped.locations} empty="No location facts yet." />
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-xl border border-card-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Package size={16} className="text-primary" />
                <h2 className="font-display font-semibold">Props</h2>
              </div>
              <FactList facts={grouped.props} empty="No prop facts yet." />
            </section>

            <section className="rounded-xl border border-card-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                <h2 className="font-display font-semibold">Lore-Safe Notes</h2>
              </div>
              <FactList facts={grouped.rules} empty="No continuity rules yet." />
              <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
                <Textarea
                  value={checkText}
                  onChange={(event) => setCheckText(event.target.value)}
                  placeholder="Paste a scene note or script beat to check names against this bible."
                  rows={5}
                  data-testid="textarea-lore-check"
                />
                <Button
                  className="w-full bg-[#9DD0FF] text-black hover:bg-[#AED9FF]"
                  onClick={() => loreCheck.mutate()}
                  disabled={checkText.trim().length === 0 || loreCheck.isPending}
                  data-testid="button-run-lore-check"
                >
                  {loreCheck.isPending ? "Checking..." : "Run Lore Check"}
                </Button>
                {loreCheck.data && (
                  <div className="rounded-lg border border-card-border bg-background/70 p-3 text-sm" data-testid="panel-lore-check-result">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 size={15} className="text-emerald-500" />
                      {loreCheck.data.unrecognizedWords.length === 0 ? "All named terms are covered." : "Review uncatalogued terms."}
                    </div>
                    {loreCheck.data.matchedEntities.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Matched: {loreCheck.data.matchedEntities.map((fact) => fact.title).join(", ")}
                      </p>
                    )}
                    {loreCheck.data.unrecognizedWords.length > 0 && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        Add notes for: {loreCheck.data.unrecognizedWords.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

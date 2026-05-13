import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowUp, ArrowDown, Download, Plus, Trash2, Scroll, Save, Film } from "lucide-react";
import { buildCreditRollText, buildPressKitSections, type PressKitCredit } from "./press-kit";

interface CreditEntry {
  id: number;
  projectId: number;
  section: "cast" | "crew";
  role: string;
  name: string;
  orderIdx: number;
  createdAt: string;
}

export default function CreditRoll() {
  const params = useParams() as { id: string };
  const projectId = parseInt(params.id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"cast" | "crew">("cast");

  // Local state for editing
  const [castEntries, setCastEntries] = useState<Omit<CreditEntry, "id" | "projectId" | "createdAt">[]>([]);
  const [crewEntries, setCrewEntries] = useState<Omit<CreditEntry, "id" | "projectId" | "createdAt">[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Add form state
  const [newRole, setNewRole] = useState("");
  const [newName, setNewName] = useState("");
  const [pressSynopsis, setPressSynopsis] = useState("");
  const [pressContact, setPressContact] = useState("");

  const { data: serverEntries = [], isLoading } = useQuery<CreditEntry[]>({
    queryKey: ["/api/projects", projectId, "studio/credits"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/studio/credits`);
      return res.json();
    },
  });

  const { data: projectDetail } = useQuery<{ project: { title: string; description?: string } }>({
    queryKey: ["/api/projects", projectId],
  });

  // Sync server data to local state
  useEffect(() => {
    if (!isDirty) {
      setCastEntries(
        serverEntries
          .filter((e) => e.section === "cast")
          .sort((a, b) => a.orderIdx - b.orderIdx)
          .map(({ id: _id, projectId: _pid, createdAt: _ca, ...rest }) => rest)
      );
      setCrewEntries(
        serverEntries
          .filter((e) => e.section === "crew")
          .sort((a, b) => a.orderIdx - b.orderIdx)
          .map(({ id: _id, projectId: _pid, createdAt: _ca, ...rest }) => rest)
      );
    }
  }, [serverEntries, isDirty]);

  useEffect(() => {
    if (!pressSynopsis && projectDetail?.project.description) {
      setPressSynopsis(projectDetail.project.description);
    }
  }, [projectDetail, pressSynopsis]);

  const saveMutation = useMutation({
    mutationFn: async (entries: typeof castEntries) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/studio/credits`, entries);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "studio/credits"] });
      setIsDirty(false);
      toast({ title: "Credits saved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    const allEntries = [
      ...castEntries.map((e, i) => ({ ...e, section: "cast" as const, orderIdx: i })),
      ...crewEntries.map((e, i) => ({ ...e, section: "crew" as const, orderIdx: i })),
    ];
    saveMutation.mutate(allEntries);
  };

  const handleAdd = () => {
    if (!newRole.trim() || !newName.trim()) {
      toast({ title: "Fill in role and name", variant: "destructive" });
      return;
    }
    const entry = { section: activeSection, role: newRole.trim(), name: newName.trim(), orderIdx: 0 };
    if (activeSection === "cast") {
      setCastEntries((prev) => [...prev, { ...entry, orderIdx: prev.length }]);
    } else {
      setCrewEntries((prev) => [...prev, { ...entry, orderIdx: prev.length }]);
    }
    setIsDirty(true);
    setNewRole("");
    setNewName("");
  };

  const moveUp = (section: "cast" | "crew", idx: number) => {
    if (idx === 0) return;
    const setter = section === "cast" ? setCastEntries : setCrewEntries;
    setter((prev) => {
      const arr = [...prev];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return arr.map((e, i) => ({ ...e, orderIdx: i }));
    });
    setIsDirty(true);
  };

  const moveDown = (section: "cast" | "crew", idx: number, len: number) => {
    if (idx === len - 1) return;
    const setter = section === "cast" ? setCastEntries : setCrewEntries;
    setter((prev) => {
      const arr = [...prev];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return arr.map((e, i) => ({ ...e, orderIdx: i }));
    });
    setIsDirty(true);
  };

  const removeEntry = (section: "cast" | "crew", idx: number) => {
    const setter = section === "cast" ? setCastEntries : setCrewEntries;
    setter((prev) => prev.filter((_, i) => i !== idx).map((e, i) => ({ ...e, orderIdx: i })));
    setIsDirty(true);
  };

  const allCreditEntries = [
    ...castEntries.map((e, i) => ({ ...e, section: "cast" as const, orderIdx: i })),
    ...crewEntries.map((e, i) => ({ ...e, section: "crew" as const, orderIdx: i })),
  ];

  const downloadText = (filename: string, contents: string) => {
    const blob = new Blob([contents], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const safeTitle = (projectDetail?.project.title || `project-${projectId}`)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "cel-project";

  const handleDownloadCreditsText = () => {
    downloadText(`${safeTitle}-credits.txt`, buildCreditRollText(allCreditEntries as PressKitCredit[]));
  };

  const handleExportPressKit = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const sections = buildPressKitSections({
      title: projectDetail?.project.title || "Cel Project",
      synopsis: pressSynopsis,
      contact: pressContact,
      credits: allCreditEntries as PressKitCredit[],
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(projectDetail?.project.title || "Cel Project", 14, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Press kit generated ${new Date().toLocaleDateString()}`, 14, 28);

    let y = 42;
    sections.forEach((section) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(section.heading, 14, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(section.body, 180);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 10;
    });

    doc.save(`${safeTitle}-press-kit.pdf`);
    toast({ title: "Press kit PDF exported" });
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const renderSection = (section: "cast" | "crew", entries: typeof castEntries) => (
    <div className="space-y-1.5">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No {section} credits yet.
        </p>
      ) : (
        entries.map((entry, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
            data-testid={`row-credit-${section}-${idx}`}
          >
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
              <span className="text-xs text-muted-foreground truncate">{entry.role}</span>
              <span className="text-sm font-medium truncate">{entry.name}</span>
            </div>
            <div className="flex gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveUp(section, idx)}
                disabled={idx === 0}
                data-testid={`button-move-up-${section}-${idx}`}
              >
                <ArrowUp size={11} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => moveDown(section, idx, entries.length)}
                disabled={idx === entries.length - 1}
                data-testid={`button-move-down-${section}-${idx}`}
              >
                <ArrowDown size={11} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => removeEntry(section, idx)}
                data-testid={`button-remove-credit-${section}-${idx}`}
              >
                <Trash2 size={11} />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );

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
          <Scroll size={20} className="text-primary" />
          <h1 className="text-xl font-bold font-display">Credit Roll Builder</h1>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || !isDirty}
          data-testid="button-save-credits"
        >
          <Save size={14} className="mr-1" />
          {isDirty ? "Save Changes" : "Saved"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setPreviewOpen(true)}
          data-testid="button-preview-credits"
        >
          <Scroll size={14} className="mr-1" /> Preview Credit Roll
        </Button>
        <Button
          variant="outline"
          onClick={handleDownloadCreditsText}
          disabled={allCreditEntries.length === 0}
          data-testid="button-download-credit-text"
        >
          <Download size={14} className="mr-1" /> Credits Text
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const a = document.createElement("a");
            a.href = `/api/projects/${projectId}/export/credit-roll-png`;
            a.download = `${safeTitle}-credit-roll.png`;
            a.click();
          }}
          disabled={allCreditEntries.length === 0}
          data-testid="button-download-credit-png"
        >
          <Film size={14} className="mr-1" /> PNG Roll
        </Button>
      </div>

      {/* Add entry form */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Add Credit Entry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Section toggle */}
          <div className="flex gap-2">
            <Button
              variant={activeSection === "cast" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSection("cast")}
              data-testid="button-section-cast"
            >
              Cast
            </Button>
            <Button
              variant={activeSection === "crew" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveSection("crew")}
              data-testid="button-section-crew"
            >
              Crew
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap items-end">
            <div>
              <Label className="text-xs mb-1 block">Role</Label>
              <Input
                placeholder="e.g. Director"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-40"
                data-testid="input-credit-role"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Name</Label>
              <Input
                placeholder="e.g. Jane Smith"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-40"
                data-testid="input-credit-name"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <Button onClick={handleAdd} data-testid="button-add-credit">
              <Plus size={14} className="mr-1" /> Add to {activeSection === "cast" ? "Cast" : "Crew"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cast section */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Cast ({castEntries.length})</CardTitle>
        </CardHeader>
        <CardContent>{renderSection("cast", castEntries)}</CardContent>
      </Card>

      {/* Crew section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Crew ({crewEntries.length})</CardTitle>
        </CardHeader>
        <CardContent>{renderSection("crew", crewEntries)}</CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Press Kit Generator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Synopsis</Label>
            <Textarea
              value={pressSynopsis}
              onChange={(e) => setPressSynopsis(e.target.value)}
              rows={3}
              placeholder="Short project synopsis for festivals, clients, or collaborators."
              data-testid="input-press-synopsis"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contact</Label>
            <Input
              value={pressContact}
              onChange={(e) => setPressContact(e.target.value)}
              placeholder="Email, site, or preferred credit contact"
              data-testid="input-press-contact"
            />
          </div>
          <Button onClick={handleExportPressKit} data-testid="button-export-press-kit">
            <Download size={14} className="mr-1" /> Export Press Kit PDF
          </Button>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl bg-black border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white text-center font-display text-lg">Credit Roll Preview</DialogTitle>
          </DialogHeader>
          <div className="relative overflow-hidden" style={{ height: 480 }}>
            {castEntries.length === 0 && crewEntries.length === 0 ? (
              <p className="text-center text-gray-400 mt-32">No credits to show.</p>
            ) : (
              <div
                className="absolute w-full"
                style={{
                  animation: "creditScroll 15s linear forwards",
                  bottom: 0,
                }}
              >
                {castEntries.length > 0 && (
                  <div className="mb-8">
                    <p className="text-gray-400 text-xs uppercase tracking-widest text-center mb-4">Cast</p>
                    {castEntries.map((e, i) => (
                      <div key={i} className="flex justify-between px-12 py-1">
                        <span className="text-gray-300 text-sm">{e.role}</span>
                        <span className="text-white text-sm font-medium">{e.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {crewEntries.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-widest text-center mb-4">Crew</p>
                    {crewEntries.map((e, i) => (
                      <div key={i} className="flex justify-between px-12 py-1">
                        <span className="text-gray-300 text-sm">{e.role}</span>
                        <span className="text-white text-sm font-medium">{e.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="h-[480px]" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* CSS keyframe for scroll animation */}
      <style>{`
        @keyframes creditScroll {
          from { transform: translateY(100%); }
          to { transform: translateY(-100%); }
        }
      `}</style>
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataWorkspace } from "@/components/layout/data-workspace";
import {
  Pencil, Trash2, Plus, Download, FileText, Briefcase, Trophy, Receipt,
} from "lucide-react";

// ===== TYPES =====
type BizFestival = {
  id: number; userId: number; name: string; deadline: string | null;
  status: string; fee: number | null; notes: string | null;
  projectId: number | null; createdAt: string;
};
type BizContract = {
  id: number; userId: number; name: string; kind: string; body: string; createdAt: string;
};
type BizExpense = {
  id: number; userId: number; projectId: number | null; date: string;
  category: string; amount: number; notes: string | null;
  receiptUrl: string | null; createdAt: string;
};
type Commission = {
  id: number; ownerUserId: number; clientName: string; clientEmail: string;
  type: string; description: string; deadline: string | null;
  budgetRange: string; status: string; notes: string;
  createdAt: string; quoteCents: number | null;
};

// ===== STATUS COLORS =====
const FESTIVAL_STATUS_COLORS: Record<string, string> = {
  planned:   "bg-blue-500/15 text-blue-400 border-blue-500/20",
  submitted: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  accepted:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  rejected:  "bg-red-500/15 text-red-400 border-red-500/20",
};
const KIND_LABELS: Record<string, string> = {
  commission: "Commission",
  nda: "NDA",
  model_release: "Model Release",
};
const FESTIVAL_STATUSES = ["planned", "submitted", "accepted", "rejected"];
const FESTIVAL_SORT_STORAGE_KEY = "cel.biz.festivals.sort";

// ===== FESTIVAL TAB =====
function FestivalsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BizFestival | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState(() => localStorage.getItem(FESTIVAL_SORT_STORAGE_KEY) || "deadline-asc");
  const [deadlineSoonOnly, setDeadlineSoonOnly] = useState(false);
  const [form, setForm] = useState({
    name: "", deadline: "", status: "planned", fee: "", notes: "", projectId: "",
  });

  const { data: festivals = [], isLoading } = useQuery<BizFestival[]>({
    queryKey: ["/api/biz/festivals"],
  });

  useEffect(() => {
    localStorage.setItem(FESTIVAL_SORT_STORAGE_KEY, sortBy);
  }, [sortBy]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        deadline: form.deadline || null,
        status: form.status,
        fee: form.fee ? parseFloat(form.fee) : 0,
        notes: form.notes || null,
        projectId: form.projectId ? parseInt(form.projectId) : null,
      };
      if (editing) {
        await apiRequest("PATCH", `/api/biz/festivals/${editing.id}`, body);
      } else {
        await apiRequest("POST", "/api/biz/festivals", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biz/festivals"] });
      setDialogOpen(false);
      setEditing(null);
      toast({ description: editing ? "Festival updated." : "Festival added." });
    },
    onError: (e: any) => toast({ description: String(e.message), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/biz/festivals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biz/festivals"] });
      toast({ description: "Festival deleted." });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/biz/festivals/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biz/festivals"] });
      toast({ description: "Festival status updated." });
    },
    onError: (e: any) => toast({ description: String(e.message), variant: "destructive" }),
  });

  function openNew() {
    setEditing(null);
    setForm({ name: "", deadline: "", status: "planned", fee: "", notes: "", projectId: "" });
    setDialogOpen(true);
  }
  function openEdit(f: BizFestival) {
    setEditing(f);
    setForm({
      name: f.name,
      deadline: f.deadline ?? "",
      status: f.status,
      fee: f.fee != null ? String(f.fee) : "",
      notes: f.notes ?? "",
      projectId: f.projectId != null ? String(f.projectId) : "",
    });
    setDialogOpen(true);
  }

  const visibleFestivals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const soon = new Date(today);
    soon.setDate(soon.getDate() + 30);

    return [...festivals]
      .filter((festival) => {
        if (!deadlineSoonOnly) return true;
        if (!festival.deadline) return false;
        const deadline = new Date(`${festival.deadline}T00:00:00`);
        return deadline >= today && deadline <= soon;
      })
      .sort((a, b) => {
        if (sortBy === "deadline-desc") return (b.deadline ?? "9999-12-31").localeCompare(a.deadline ?? "9999-12-31");
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "newest") return b.createdAt.localeCompare(a.createdAt);
        return (a.deadline ?? "9999-12-31").localeCompare(b.deadline ?? "9999-12-31");
      });
  }, [deadlineSoonOnly, festivals, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Track film festival and competition submissions.</p>
        <Button size="sm" onClick={openNew} data-testid="button-add-festival">
          <Plus size={14} className="mr-1" /> Add Festival
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={deadlineSoonOnly ? "default" : "outline"}
          size="sm"
          className="h-8"
          onClick={() => setDeadlineSoonOnly((value) => !value)}
          data-testid="filter-festival-deadline-soon"
        >
          Deadline within 30 days
        </Button>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-8 w-44" data-testid="select-festival-sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deadline-asc">Deadline ↑</SelectItem>
            <SelectItem value="deadline-desc">Deadline ↓</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
      ) : festivals.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No festivals tracked yet. Add your first submission above.
        </div>
      ) : visibleFestivals.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No festivals match the current filters.
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Festival</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleFestivals.map((f) => (
                <TableRow key={f.id} data-testid={`row-festival-${f.id}`}>
                  <TableCell className="font-medium">{f.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{f.deadline ?? "—"}</TableCell>
                  <TableCell>
                    <Select
                      value={f.status}
                      onValueChange={(status) => statusMutation.mutate({ id: f.id, status })}
                      disabled={statusMutation.isPending}
                    >
                      <SelectTrigger
                        className="h-auto w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0"
                        aria-label={`Change status for ${f.name}`}
                        data-testid={`select-festival-status-inline-${f.id}`}
                      >
                        <Badge variant="outline" className={FESTIVAL_STATUS_COLORS[f.status] ?? ""}>
                          <SelectValue />
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {FESTIVAL_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm">{f.fee ? `$${f.fee.toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{f.notes ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(f)} data-testid={`button-edit-festival-${f.id}`}>
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(f.id)} data-testid={`button-delete-festival-${f.id}`}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Festival" : "Add Festival Submission"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Festival / Competition Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Sundance, SIGGRAPH…" data-testid="input-festival-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Deadline</Label>
                <Input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} data-testid="input-festival-deadline" />
              </div>
              <div>
                <Label>Submission Fee ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.fee} onChange={e => setForm(p => ({ ...p, fee: e.target.value }))} placeholder="0.00" data-testid="input-festival-fee" />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger data-testid="select-festival-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Screenings, contact info…" data-testid="input-festival-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} data-testid="button-save-festival">
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete festival entry?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteMutation.mutate(deleteId!); setDeleteId(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===== CONTRACTS TAB =====
function ContractsTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewContract, setViewContract] = useState<BizContract | null>(null);
  const [editing, setEditing] = useState<BizContract | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");
  const [form, setForm] = useState({ name: "", kind: "commission" as string, body: "" });

  const { data: contracts = [], isLoading } = useQuery<BizContract[]>({
    queryKey: ["/api/biz/contracts"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        await apiRequest("PATCH", `/api/biz/contracts/${editing.id}`, form);
      } else {
        await apiRequest("POST", "/api/biz/contracts", form);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biz/contracts"] });
      setDialogOpen(false);
      setEditing(null);
      toast({ description: editing ? "Contract template updated." : "Contract template created." });
    },
    onError: (e: any) => toast({ description: String(e.message), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/biz/contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biz/contracts"] });
      toast({ description: "Template deleted." });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (contract: BizContract) => {
      await apiRequest("POST", "/api/biz/contracts", {
        name: `${contract.name} Copy`,
        kind: contract.kind,
        body: contract.body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biz/contracts"] });
      toast({ description: "Template duplicated." });
    },
    onError: (e: any) => toast({ description: String(e.message), variant: "destructive" }),
  });

  function openNew() {
    setEditing(null);
    setForm({ name: "", kind: "commission", body: "" });
    setDialogOpen(true);
  }
  function openEdit(c: BizContract) {
    setEditing(c);
    setForm({ name: c.name, kind: c.kind, body: c.body });
    setDialogOpen(true);
  }

  const filteredContracts = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    if (!query) return contracts;
    return contracts.filter((contract) =>
      [contract.name, contract.kind, contract.body].some((value) => value.toLowerCase().includes(query)),
    );
  }, [contracts, templateSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Saved contract & release form templates. Click a template to view/copy.</p>
        <Button size="sm" onClick={openNew} data-testid="button-add-contract">
          <Plus size={14} className="mr-1" /> New Template
        </Button>
      </div>
      <Input
        value={templateSearch}
        onChange={(e) => setTemplateSearch(e.target.value)}
        placeholder="Search templates by name, kind, or text…"
        data-testid="input-contract-search"
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
      ) : contracts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No templates yet.</div>
      ) : filteredContracts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No templates match your search.</div>
      ) : (
        <div className="grid gap-3">
          {filteredContracts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors cursor-pointer"
              onClick={() => setViewContract(c)}
              data-testid={`card-contract-${c.id}`}
            >
              <FileText size={18} className="text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {KIND_LABELS[c.kind] ?? c.kind} • {new Date(c.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => duplicateMutation.mutate(c)}
                  disabled={duplicateMutation.isPending}
                  data-testid={`button-duplicate-contract-${c.id}`}
                >
                  Duplicate
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)} data-testid={`button-edit-contract-${c.id}`}>
                  <Pencil size={13} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)} data-testid={`button-delete-contract-${c.id}`}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewContract} onOpenChange={() => setViewContract(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewContract?.name}</DialogTitle>
          </DialogHeader>
          <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/40 rounded p-4 text-foreground leading-relaxed">{viewContract?.body}</pre>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(viewContract?.body ?? "");
                toast({ description: "Copied to clipboard." });
              }}
              data-testid="button-copy-contract"
            >
              Copy text
            </Button>
            <Button onClick={() => setViewContract(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "New Contract Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Template Name</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Commission Agreement" data-testid="input-contract-name" />
              </div>
              <div>
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={v => setForm(p => ({ ...p, kind: v }))}>
                  <SelectTrigger data-testid="select-contract-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commission">Commission</SelectItem>
                    <SelectItem value="nda">NDA</SelectItem>
                    <SelectItem value="model_release">Model Release</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Body (Markdown)</Label>
              <Textarea
                value={form.body}
                onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                rows={14}
                className="font-mono text-xs"
                placeholder="# Template content…"
                data-testid="input-contract-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.body || saveMutation.isPending} data-testid="button-save-contract">
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteMutation.mutate(deleteId!); setDeleteId(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===== TAX CSV TAB =====
function TaxCsvTab() {
  const { toast } = useToast();
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const { data: commissions = [], isLoading } = useQuery<Commission[]>({
    queryKey: ["/api/commissions"],
  });

  // Only completed commissions
  const completed = useMemo(
    () => commissions.filter((c) => c.status === "completed"),
    [commissions]
  );

  // Group by client name + year to compute 1099 eligibility
  const rows = useMemo(() => {
    return completed
      .map((c) => {
        const amount = c.quoteCents ? c.quoteCents / 100 : 0;
        // Platform fee: 0 (we don't know it here, show 0)
        const fee = 0;
        const net = amount - fee;
        // Sum all completed commissions from same client in same year
        const clientYear = c.createdAt ? c.createdAt.slice(0, 4) : "—";
        const clientTotal = completed
          .filter((x) => x.clientName === c.clientName && (x.createdAt ?? "").slice(0, 4) === clientYear)
          .reduce((sum, x) => sum + (x.quoteCents ? x.quoteCents / 100 : 0), 0);
        const eligible1099 = clientTotal >= 600 ? "Y" : "N";
        return {
          date: c.createdAt ? c.createdAt.slice(0, 10) : "",
          client: c.clientName,
          amount,
          fee,
          net,
          eligible1099,
          year: clientYear,
          clientTotal,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [completed]);

  const filteredRows = useMemo(
    () => (year && year !== "all" ? rows.filter((r) => r.year === year) : rows),
    [rows, year]
  );

  function downloadCsv() {
    const header = "Date,Client,Amount,Fee,Net,1099_Eligible";
    const lines = filteredRows.map((r) =>
      [r.date, `"${r.client.replace(/"/g, '""')}"`, r.amount.toFixed(2), r.fee.toFixed(2), r.net.toFixed(2), r.eligible1099].join(",")
    );
    const totalsLine = ["TOTAL", "", totalAmount.toFixed(2), totalFee.toFixed(2), totalNet.toFixed(2), ""].join(",");
    const csv = [header, ...lines, totalsLine].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `commissions_tax_${year && year !== "all" ? year : "all"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ description: "CSV downloaded." });
  }

  const years = useMemo(() => {
    const ys = Array.from(new Set(rows.map((r) => r.year))).filter(Boolean).sort().reverse();
    return ys;
  }, [rows]);

  const totalAmount = useMemo(() => filteredRows.reduce((s, r) => s + r.amount, 0), [filteredRows]);
  const totalFee = useMemo(() => filteredRows.reduce((s, r) => s + r.fee, 0), [filteredRows]);
  const totalNet = useMemo(() => filteredRows.reduce((s, r) => s + r.net, 0), [filteredRows]);
  const eligibleClientCount = useMemo(() => {
    const uniqueClients = new Set(
      filteredRows
        .filter((r) => r.clientTotal >= 600)
        .map((r) => `${r.client}::${r.year}`),
    );
    return uniqueClients.size;
  }, [filteredRows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm text-muted-foreground">Export completed commissions as a tax CSV. Flags clients with ≥ $600 in a calendar year.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28" data-testid="select-tax-year">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={downloadCsv} disabled={filteredRows.length === 0} data-testid="button-export-tax-csv">
            <Download size={14} className="mr-1" /> Export Tax CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 text-sm" data-testid="card-tax-1099-summary">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">1099-ready clients</div>
        <div className="mt-1 text-2xl font-semibold text-foreground">{eligibleClientCount}</div>
        <p className="text-xs text-muted-foreground">Unique client/year totals at or above $600 in the current filter.</p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
      ) : filteredRows.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No completed commissions found{year && year !== "all" ? ` for ${year}` : ""}.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>1099 Eligible?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r, i) => (
                  <TableRow key={i} data-testid={`row-tax-${i}`}>
                    <TableCell className="text-sm">{r.date}</TableCell>
                    <TableCell className="font-medium">{r.client}</TableCell>
                    <TableCell className="text-sm">${r.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-sm">${r.fee.toFixed(2)}</TableCell>
                    <TableCell className="text-sm">${r.net.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={r.eligible1099 === "Y" ? "bg-amber-500/15 text-amber-400 border-amber-500/20" : ""}
                        title={`${r.client} ${r.year} total: $${r.clientTotal.toFixed(2)}`}
                      >
                        {r.eligible1099}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="text-right text-sm font-medium pr-2">
            Total net: <span className="text-primary">${totalNet.toFixed(2)}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ===== EXPENSES TAB =====
function ExpensesTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BizExpense | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "",
    amount: "",
    notes: "",
    receiptUrl: "",
    projectId: "",
  });

  const { data: expenses = [], isLoading } = useQuery<BizExpense[]>({
    queryKey: ["/api/biz/expenses"],
  });

  // Monthly total — current month
  const monthlyTotal = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    return expenses
      .filter((e) => e.date.startsWith(ym))
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  const ytdTotal = useMemo(() => {
    const year = new Date().toISOString().slice(0, 4);
    return expenses
      .filter((e) => e.date.startsWith(year))
      .reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  const categories = useMemo(() => {
    return Array.from(new Set(expenses.map((e) => e.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        date: form.date,
        category: form.category,
        amount: parseFloat(form.amount),
        notes: form.notes || null,
        receiptUrl: form.receiptUrl || null,
        projectId: form.projectId ? parseInt(form.projectId) : null,
      };
      if (editing) {
        await apiRequest("PATCH", `/api/biz/expenses/${editing.id}`, body);
      } else {
        await apiRequest("POST", "/api/biz/expenses", body);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biz/expenses"] });
      setDialogOpen(false);
      setEditing(null);
      toast({ description: editing ? "Expense updated." : "Expense logged." });
    },
    onError: (e: any) => toast({ description: String(e.message), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/biz/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/biz/expenses"] });
      toast({ description: "Expense deleted." });
    },
  });

  function openNew() {
    setEditing(null);
    setForm({ date: new Date().toISOString().slice(0, 10), category: "", amount: "", notes: "", receiptUrl: "", projectId: "" });
    setDialogOpen(true);
  }
  function openEdit(e: BizExpense) {
    setEditing(e);
    setForm({
      date: e.date,
      category: e.category,
      amount: String(e.amount),
      notes: e.notes ?? "",
      receiptUrl: e.receiptUrl ?? "",
      projectId: e.projectId != null ? String(e.projectId) : "",
    });
    setDialogOpen(true);
  }

  function isImageReceipt(url: string) {
    return /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(url) || url.startsWith("data:image/");
  }

  function openReceipt(url: string) {
    if (isImageReceipt(url)) {
      setReceiptPreviewUrl(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Group by month for display
  const grouped = useMemo(() => {
    const map = new Map<string, BizExpense[]>();
    const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
    for (const exp of sorted) {
      const ym = exp.date.slice(0, 7);
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym)!.push(exp);
    }
    return Array.from(map.entries());
  }, [expenses]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Track project-linked and general business expenses.</p>
          <p className="text-sm font-medium mt-1">
            This month: <span className="text-primary">${monthlyTotal.toFixed(2)}</span>
            <span className="mx-2 text-muted-foreground">•</span>
            YTD: <span className="text-primary">${ytdTotal.toFixed(2)}</span>
          </p>
        </div>
        <Button size="sm" onClick={openNew} data-testid="button-add-expense">
          <Plus size={14} className="mr-1" /> Add Expense
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
      ) : expenses.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">No expenses logged yet.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([ym, exps]) => {
            const monthTotal = exps.reduce((s, e) => s + e.amount, 0);
            return (
              <div key={ym}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {new Date(ym + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <span className="text-xs text-muted-foreground">${monthTotal.toFixed(2)}</span>
                </div>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Receipt</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exps.map((exp) => (
                        <TableRow key={exp.id} data-testid={`row-expense-${exp.id}`}>
                          <TableCell className="text-sm">{exp.date}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{exp.category}</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-sm">${exp.amount.toFixed(2)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[140px] truncate">{exp.notes ?? "—"}</TableCell>
                          <TableCell>
                            {exp.receiptUrl ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-primary text-xs underline"
                                onClick={() => openReceipt(exp.receiptUrl!)}
                                data-testid={`button-preview-receipt-${exp.id}`}
                              >
                                View
                              </Button>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(exp)} data-testid={`button-edit-expense-${exp.id}`}>
                                <Pencil size={13} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(exp.id)} data-testid={`button-delete-expense-${exp.id}`}>
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Expense" : "Log Expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} data-testid="input-expense-date" />
              </div>
              <div>
                <Label>Amount ($)</Label>
                <Input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" data-testid="input-expense-amount" />
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Input
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                placeholder="Software, Equipment, Travel…"
                list="expense-category-suggestions"
                data-testid="input-expense-category"
              />
              <datalist id="expense-category-suggestions">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional details…" data-testid="input-expense-notes" />
            </div>
            <div>
              <Label>Receipt URL (optional)</Label>
              <Input value={form.receiptUrl} onChange={e => setForm(p => ({ ...p, receiptUrl: e.target.value }))} placeholder="https://…" data-testid="input-expense-receipt" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.date || !form.category || !form.amount || saveMutation.isPending}
              data-testid="button-save-expense"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiptPreviewUrl} onOpenChange={() => setReceiptPreviewUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Receipt preview</DialogTitle>
          </DialogHeader>
          {receiptPreviewUrl && (
            <div className="rounded-lg border border-border bg-muted/30 p-2">
              <img src={receiptPreviewUrl} alt="Receipt preview" className="max-h-[70vh] w-full rounded object-contain" />
            </div>
          )}
          <DialogFooter>
            {receiptPreviewUrl && (
              <Button variant="outline" onClick={() => window.open(receiptPreviewUrl, "_blank", "noopener,noreferrer")}>
                Open in new tab
              </Button>
            )}
            <Button onClick={() => setReceiptPreviewUrl(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteMutation.mutate(deleteId!); setDeleteId(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===== MAIN PAGE =====
export default function BizPage() {
  const { user } = useAuth();
  const { data: festivals = [] } = useQuery<BizFestival[]>({
    queryKey: ["/api/biz/festivals"],
    enabled: !!user,
  });
  const { data: contracts = [] } = useQuery<BizContract[]>({
    queryKey: ["/api/biz/contracts"],
    enabled: !!user,
  });
  const { data: expenses = [] } = useQuery<BizExpense[]>({
    queryKey: ["/api/biz/expenses"],
    enabled: !!user,
  });
  const { data: commissions = [] } = useQuery<Commission[]>({
    queryKey: ["/api/commissions"],
    enabled: !!user,
  });

  if (!user) return null;

  const pendingFestivals = festivals.filter((festival) => festival.status === "planned" || festival.status === "submitted").length;
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <Tabs defaultValue="festivals" className="w-full">
      <DataWorkspace
        title="Business"
        icon={<Briefcase size={20} className="text-primary" />}
        description="Manage festivals, contracts, tax exports, and expense tracking without leaving the authenticated workspace."
        summary={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryStat label="Active submissions" value={String(pendingFestivals)} detail="Planned or submitted festivals" />
            <SummaryStat label="Contracts" value={String(contracts.length)} detail="Reusable legal templates" />
            <SummaryStat label="Expenses" value={`$${expenseTotal.toFixed(2)}`} detail={`${expenses.length} logged items`} />
            <SummaryStat label="Commission pipeline" value={String(commissions.length)} detail="Shared with queue and analytics" />
          </div>
        }
        filters={
          <TabsList className="flex h-auto flex-wrap gap-2 bg-transparent p-0">
            <TabsTrigger value="festivals" data-testid="tab-festivals">
              <Trophy size={13} className="mr-1.5" /> Festivals
            </TabsTrigger>
            <TabsTrigger value="contracts" data-testid="tab-contracts">
              <FileText size={13} className="mr-1.5" /> Contracts
            </TabsTrigger>
            <TabsTrigger value="tax" data-testid="tab-tax">
              <Download size={13} className="mr-1.5" /> Tax CSV
            </TabsTrigger>
            <TabsTrigger value="expenses" data-testid="tab-expenses">
              <Receipt size={13} className="mr-1.5" /> Expenses
            </TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="festivals" className="mt-0">
          <FestivalsTab />
        </TabsContent>
        <TabsContent value="contracts" className="mt-0">
          <ContractsTab />
        </TabsContent>
        <TabsContent value="tax" className="mt-0">
          <TaxCsvTab />
        </TabsContent>
        <TabsContent value="expenses" className="mt-0">
          <ExpensesTab />
        </TabsContent>
      </DataWorkspace>
    </Tabs>
  );
}

function SummaryStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/84 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

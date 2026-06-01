import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Film, Zap, DollarSign, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

interface RenderEvent {
  id: number;
  projectId: number;
  label: string;
  minutes: number;
  cost: number | null;
  createdAt: string;
}

interface RenderBudgetData {
  projectId: number;
  totalMinutes: number;
  updatedAt: string;
}

interface BudgetResponse {
  budget: RenderBudgetData;
  events: RenderEvent[];
}

export default function RenderBudget() {
  const params = useParams() as { id: string };
  const projectId = parseInt(params.id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [newLabel, setNewLabel] = useState("");
  const [newMinutes, setNewMinutes] = useState("");
  const [newCost, setNewCost] = useState("");
  const [budgetInput, setBudgetInput] = useState("");

  // Power cost estimator state
  const [gpuWatts, setGpuWatts] = useState("350");
  const [kwhRate, setKwhRate] = useState("0.13");

  const { data, isLoading } = useQuery<BudgetResponse>({
    queryKey: ["/api/projects", projectId, "studio/render-budget"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/studio/render-budget`);
      return res.json();
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async (totalMinutes: number) => {
      const res = await apiRequest("PUT", `/api/projects/${projectId}/studio/render-budget`, { totalMinutes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "studio/render-budget"] });
      setBudgetInput("");
      toast({ title: "Budget updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addEventMutation = useMutation({
    mutationFn: async (event: { label: string; minutes: number; cost: number }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/studio/render-events`, event);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "studio/render-budget"] });
      setNewLabel("");
      setNewMinutes("");
      setNewCost("");
      toast({ title: "Render event added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const res = await apiRequest("DELETE", `/api/projects/${projectId}/studio/render-events/${eventId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "studio/render-budget"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const budget = data?.budget ?? { projectId, totalMinutes: 600, updatedAt: "" };
  const events = data?.events ?? [];
  const totalUsed = events.reduce((sum, e) => sum + e.minutes, 0);
  const usedPct = budget.totalMinutes > 0 ? (totalUsed / budget.totalMinutes) * 100 : 0;

  // Power cost estimator calculation
  const wattsNum = parseFloat(gpuWatts) || 0;
  const rateNum = parseFloat(kwhRate) || 0;
  const totalHours = totalUsed / 60;
  const kwhUsed = (wattsNum / 1000) * totalHours;
  const estimatedPowerCost = kwhUsed * rateNum;
  const loggedCostTotal = events.reduce((sum, e) => sum + (e.cost || 0), 0);

  // Burndown chart data: cumulative used over time
  const chartData = events.reduce<{ label: string; used: number; remaining: number }[]>(
    (acc, ev) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].used : 0;
      const used = prev + ev.minutes;
      acc.push({ label: ev.label, used, remaining: Math.max(0, budget.totalMinutes - used) });
      return acc;
    },
    []
  );

  // Color for budget bar
  const barColor = usedPct > 95 ? "#ef4444" : usedPct > 70 ? "#f59e0b" : "#22c55e";

  const handleAddEvent = () => {
    const mins = parseFloat(newMinutes);
    if (!newLabel.trim() || isNaN(mins) || mins <= 0) {
      toast({ title: "Fill in label and valid minutes", variant: "destructive" });
      return;
    }
    addEventMutation.mutate({
      label: newLabel.trim(),
      minutes: mins,
      cost: parseFloat(newCost) || 0,
    });
  };

  const handleUpdateBudget = () => {
    const mins = parseFloat(budgetInput);
    if (isNaN(mins) || mins <= 0) {
      toast({ title: "Enter a valid number of minutes", variant: "destructive" });
      return;
    }
    updateBudgetMutation.mutate(mins);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Render Budget Invoice", 14, 22);
    doc.setFontSize(11);
    doc.text(`Project ID: ${projectId}`, 14, 30);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 36);
    
    doc.text(`Total Minutes Budgeted: ${budget.totalMinutes.toFixed(1)} min`, 14, 46);
    doc.text(`Total Minutes Used: ${totalUsed.toFixed(1)} min`, 14, 52);
    doc.text(`Estimated Power Cost: $${estimatedPowerCost.toFixed(2)}`, 14, 58);
    doc.text(`Logged Financial Cost: $${loggedCostTotal.toFixed(2)}`, 14, 64);

    const tableData = events.map(e => [
      e.label,
      `${e.minutes.toFixed(1)} min`,
      e.cost ? `$${e.cost.toFixed(2)}` : "-",
      new Date(e.createdAt).toLocaleDateString()
    ]);

    // Simple manual table (no jspdf-autotable dep)
    let y = 70;
    doc.setFontSize(10);
    doc.text(["Label", "Duration", "Cost", "Date"].join("   |   "), 14, y);
    y += 6;
    tableData.forEach((row: any[]) => {
      doc.text(row.join("   |   "), 14, y);
      y += 5;
      if (y > 280) { doc.addPage(); y = 20; }
    });

    doc.save(`render-invoice-project-${projectId}.pdf`);
    toast({ title: "Invoice exported" });
  };

  return (
    <div className="px-5 sm:px-6 lg:px-10 py-7 lg:py-10 max-w-4xl mx-auto">
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
          <Film size={20} className="text-primary" />
          <h1 className="text-xl font-bold font-display">Render Budget</h1>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
          <FileDown size={14} className="mr-1.5" /> Export PDF Invoice
        </Button>
      </div>

      {/* Budget summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Budget</p>
            <p className="text-2xl font-bold" data-testid="text-total-budget">{budget.totalMinutes.toFixed(1)} min</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Used</p>
            <p className="text-2xl font-bold" style={{ color: barColor }} data-testid="text-used-budget">
              {totalUsed.toFixed(1)} min
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Remaining</p>
            <p className="text-2xl font-bold" data-testid="text-remaining-budget">
              {Math.max(0, budget.totalMinutes - totalUsed).toFixed(1)} min
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Budget used</span>
          <span>{usedPct.toFixed(1)}%</span>
        </div>
        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, usedPct)}%`, backgroundColor: barColor }}
            data-testid="progress-budget"
          />
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Burn-Down Chart</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number, name: string) => [`${val.toFixed(1)} min`, name === "used" ? "Cumulative Used" : "Remaining"]}
                />
                <ReferenceLine y={budget.totalMinutes} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "Budget", fontSize: 10, fill: "#ef4444" }} />
                <Bar dataKey="used" name="used" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => {
                    const pct = budget.totalMinutes > 0 ? (entry.used / budget.totalMinutes) * 100 : 0;
                    const color = pct > 95 ? "#ef4444" : pct > 70 ? "#f59e0b" : "#22c55e";
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ⚡ Power Cost Estimator */}
      <Card className="mb-6 border-amber-200/60 dark:border-amber-900/40">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap size={15} className="text-amber-500" />
            Power Cost Estimator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <Label className="text-xs mb-1 block">GPU Wattage (W)</Label>
              <Input
                type="number"
                min={0}
                step={10}
                value={gpuWatts}
                onChange={(e) => setGpuWatts(e.target.value)}
                className="w-28"
                data-testid="input-gpu-watts"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Electricity Rate ($/kWh)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={kwhRate}
                onChange={(e) => setKwhRate(e.target.value)}
                className="w-28"
                data-testid="input-kwh-rate"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Render Hours</p>
              <p className="text-lg font-bold font-mono">{totalHours.toFixed(2)}h</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">kWh Consumed</p>
              <p className="text-lg font-bold font-mono">{kwhUsed.toFixed(3)}</p>
            </div>
            <div className="rounded-lg bg-amber-50/60 dark:bg-amber-900/20 p-3">
              <p className="text-xs text-muted-foreground mb-1">Est. Power Cost</p>
              <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400" data-testid="text-power-cost">
                ${estimatedPowerCost.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Logged Costs</p>
              <p className="text-lg font-bold font-mono flex items-center justify-center gap-1">
                <DollarSign size={14} />{loggedCostTotal.toFixed(2)}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Estimated based on {wattsNum}W GPU × {totalHours.toFixed(2)}h render time @ ${rateNum}/kWh.
            Adjust to match your hardware and energy tariff.
          </p>
        </CardContent>
      </Card>

      {/* Update budget */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Update Total Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder={`Current: ${budget.totalMinutes} min`}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="w-48"
              data-testid="input-budget"
            />
            <Button
              onClick={handleUpdateBudget}
              disabled={updateBudgetMutation.isPending}
              data-testid="button-update-budget"
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add render event */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Add Render Event</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs mb-1 block">Scene / Shot Label</Label>
              <Input
                placeholder="e.g. Scene 3A"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-44 font-mono"
                data-testid="input-event-label"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Minutes</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                placeholder="0.0"
                value={newMinutes}
                onChange={(e) => setNewMinutes(e.target.value)}
                className="w-24"
                data-testid="input-event-minutes"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Cost $ (optional)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="$0.00"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
                className="w-24"
                data-testid="input-event-cost"
              />
            </div>
            <Button
              onClick={handleAddEvent}
              disabled={addEventMutation.isPending}
              data-testid="button-add-event"
            >
              <Plus size={14} className="mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Events list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Render Events ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No render events yet.</p>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                  data-testid={`row-render-event-${ev.id}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm font-mono truncate">{ev.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {ev.minutes.toFixed(1)} min
                      {ev.cost ? ` · $${ev.cost.toFixed(2)}` : ""}
                      {" · "}
                      {new Date(ev.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteEventMutation.mutate(ev.id)}
                    data-testid={`button-delete-event-${ev.id}`}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

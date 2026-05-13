import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, Clock3, Flame, Grid3X3 } from "lucide-react";
import { format } from "date-fns";
import type { Commission } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface HeatmapScene {
  sceneId: number;
  sceneName: string;
  days: Record<string, number>;
}

interface TaskHoursRow {
  sceneId: number;
  sceneNumber: string;
  sceneName: string;
  projectName: string;
  status: string;
  totalMs: number;
  sessions: number;
  estimatedFrames: number;
  minutesPerFrame: number;
  lastTrackedAt: string | null;
}

function formatDuration(ms: number): string {
  const hours = ms / 3_600_000;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${Math.round(ms / 60_000)}m`;
}

function formatRate(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return `${value.toFixed(2)} min/frame`;
}

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [hoverData, setHoverData] = useState<{ day: string; scene: string; mins: number } | null>(null);

  const { data: commissions = [] } = useQuery<Commission[]>({
    queryKey: ["/api/commissions"],
  });

  const { data: commissionHours = {} } = useQuery<{ [key: number]: number }>({
    queryKey: ["/api/analytics/commission-hours"],
  });

  const { data: heatmap = [] } = useQuery<HeatmapScene[]>({
    queryKey: ["/api/analytics/heatmap"],
  });

  const { data: taskRows = [] } = useQuery<TaskHoursRow[]>({
    queryKey: ["/api/analytics/task-hours"],
  });

  const logHoursMut = useMutation({
    mutationFn: async ({ id, hours }: { id: number; hours: number }) => {
      await apiRequest("POST", `/api/commissions/${id}/hours`, { hours });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/commission-hours"] });
      toast({ title: "Hours logged" });
    },
  });

  const handleLogHours = (id: number, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const hours = parseFloat(formData.get("hours") as string);
    if (!isNaN(hours) && hours > 0) {
      logHoursMut.mutate({ id, hours });
      event.currentTarget.reset();
    }
  };

  const commissionStats = commissions
    .map((commission) => {
      let price = 0;
      if ((commission as any).quoteCents) {
        price = (commission as any).quoteCents / 100;
      } else if (commission.budgetRange === "Under $50") {
        price = 40;
      } else if (commission.budgetRange === "$50-$150") {
        price = 100;
      } else if (commission.budgetRange === "$150-$500") {
        price = 300;
      } else if (commission.budgetRange === "$500+") {
        price = 600;
      }

      const hours = commissionHours[commission.id] || 0;
      const rate = hours > 0 ? price / hours : 0;
      return { ...commission, price, hours, rate };
    })
    .sort((a, b) => b.rate - a.rate);

  const paidCommissionStats = commissionStats.filter((commission) => commission.rate > 0);
  const avgRate = paidCommissionStats.length > 0
    ? paidCommissionStats.reduce((sum, commission) => sum + commission.rate, 0) / paidCommissionStats.length
    : 0;
  const maxRate = Math.max(...commissionStats.map((commission) => commission.rate), 1);

  const dates = new Set<string>();
  heatmap.forEach((scene) => {
    Object.keys(scene.days).forEach((date) => dates.add(date));
  });
  const sortedDates = Array.from(dates).sort();
  const maxMins = Math.max(1, ...heatmap.flatMap((scene) => Object.values(scene.days)));
  const maxMinutesPerFrame = Math.max(0.01, ...taskRows.map((row) => row.minutesPerFrame));

  const cell = 18;
  const labelWidth = 150;
  const headerHeight = 38;
  const heatmapWidth = Math.max(360, labelWidth + sortedDates.length * cell + 24);
  const heatmapHeight = Math.max(96, headerHeight + heatmap.length * cell + 20);
  const labelEvery = Math.max(1, Math.ceil(sortedDates.length / 14));

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-10 pb-24">
      <div>
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
          <BarChart3 size={14} className="text-primary" />
          Analytics
        </div>
        <h1 className="text-2xl font-display font-bold mb-2">Commission ROI & Scene Time</h1>
        <p className="text-sm text-muted-foreground">Track true hourly rate, task effort, and hours-per-frame density.</p>
      </div>

      <section className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">Commission ROI</h2>
          <div className="px-4 py-2 bg-white/50 dark:bg-white/5 rounded-xl border glass shadow-sm">
            <span className="text-sm text-muted-foreground mr-2">Average Rate</span>
            <span className="font-mono font-bold">${avgRate.toFixed(2)}/hr</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {commissionStats.map((commission) => (
              <div key={commission.id} className="glass p-4 rounded-xl border flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{commission.clientName} - {commission.type}</div>
                  <div className="text-sm text-muted-foreground mt-1 font-mono">
                    ${commission.price.toFixed(0)} / {commission.hours}h = <strong className="text-foreground">${commission.rate.toFixed(2)}/hr</strong>
                  </div>
                </div>
                <form onSubmit={(event) => handleLogHours(commission.id, event)} className="flex items-center gap-2 flex-shrink-0">
                  <Input
                    name="hours"
                    type="number"
                    step="0.5"
                    min="0.5"
                    placeholder="Hrs"
                    className="w-16 h-8 text-sm"
                  />
                  <Button type="submit" size="sm" className="h-8 bg-[#9DD0FF] hover:bg-[#AED9FF] text-black">
                    Log
                  </Button>
                </form>
              </div>
            ))}
            {commissionStats.length === 0 && <div className="text-muted-foreground">No commissions found.</div>}
          </div>

          <div className="glass p-6 rounded-xl border h-[360px] flex flex-col justify-end gap-2 relative">
            <div className="absolute top-4 left-6 text-sm text-muted-foreground">ROI Chart</div>
            <div className="flex items-end gap-2 h-full w-full mt-8 border-b border-sidebar-border pb-2 overflow-x-auto">
              {commissionStats.map((commission) => (
                <div key={commission.id} className="flex flex-col items-center flex-shrink-0 w-12 group">
                  <div
                    className="w-full bg-[#9DD0FF] rounded-t-sm transition-all relative"
                    style={{ height: `${(commission.rate / maxRate) * 100}%`, minHeight: commission.rate > 0 ? "4px" : "0" }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none">
                      ${commission.rate.toFixed(2)}/hr
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2 truncate w-full text-center" title={commission.clientName}>
                    {commission.clientName.substring(0, 5)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Clock3 size={17} className="text-primary" />
          <h2 className="text-lg font-semibold">Task Time Table</h2>
        </div>
        <div className="glass rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Tracked</th>
                <th className="px-4 py-3 font-medium text-right">Sessions</th>
                <th className="px-4 py-3 font-medium text-right">Est. frames</th>
                <th className="px-4 py-3 font-medium text-right">Density</th>
              </tr>
            </thead>
            <tbody>
              {taskRows.map((row) => {
                const intensity = row.minutesPerFrame > 0 ? row.minutesPerFrame / maxMinutesPerFrame : 0;
                return (
                  <tr key={row.sceneId} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <span className="font-mono text-xs text-muted-foreground mr-2">{row.sceneNumber}</span>
                      {row.sceneName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.projectName}</td>
                    <td className="px-4 py-3 capitalize">{row.status}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatDuration(row.totalMs)}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.sessions}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.estimatedFrames}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className="inline-flex min-w-28 justify-end rounded-md px-2 py-1 font-mono text-xs"
                        style={{ backgroundColor: row.minutesPerFrame > 0 ? `rgba(157, 208, 255, ${Math.max(0.18, intensity)})` : "transparent" }}
                      >
                        {formatRate(row.minutesPerFrame)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {taskRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No scene tasks found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-center gap-2">
          <Grid3X3 size={17} className="text-primary" />
          <h2 className="text-lg font-semibold">Hours-Per-Frame Heatmap</h2>
        </div>
        <div className="glass p-5 rounded-xl border overflow-x-auto relative">
          {hoverData && (
            <div className="absolute top-3 right-5 bg-black text-white text-xs py-1 px-3 rounded shadow-lg pointer-events-none z-10 font-mono">
              {hoverData.scene}: {Math.round(hoverData.mins)} mins on {hoverData.day}
            </div>
          )}

          {heatmap.length > 0 && sortedDates.length > 0 ? (
            <svg
              width={heatmapWidth}
              height={heatmapHeight}
              viewBox={`0 0 ${heatmapWidth} ${heatmapHeight}`}
              role="img"
              aria-label="Scene time heatmap"
              data-testid="svg-hours-heatmap"
            >
              {sortedDates.map((date, index) => (
                index % labelEvery === 0 ? (
                  <text
                    key={date}
                    x={labelWidth + index * cell + 4}
                    y={24}
                    transform={`rotate(-35 ${labelWidth + index * cell + 4} 24)`}
                    className="fill-muted-foreground text-[9px]"
                  >
                    {format(new Date(date), "MMM d")}
                  </text>
                ) : null
              ))}

              {heatmap.map((scene, rowIndex) => {
                const y = headerHeight + rowIndex * cell;
                return (
                  <g key={scene.sceneId}>
                    <text x={0} y={y + 12} className="fill-muted-foreground text-[10px]">
                      {scene.sceneName.substring(0, 22)}
                    </text>
                    {sortedDates.map((date, colIndex) => {
                      const mins = scene.days[date] || 0;
                      const intensity = mins > 0 ? Math.max(0.16, mins / maxMins) : 0;
                      return (
                        <rect
                          key={date}
                          x={labelWidth + colIndex * cell}
                          y={y}
                          width={14}
                          height={14}
                          rx={3}
                          fill={mins > 0 ? `rgba(157, 208, 255, ${intensity})` : "rgba(120,120,120,0.12)"}
                          stroke={mins > 0 ? "rgba(157,208,255,0.65)" : "rgba(120,120,120,0.08)"}
                          onMouseEnter={() => setHoverData({ day: date, scene: scene.sceneName, mins })}
                          onMouseLeave={() => setHoverData(null)}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              <Flame size={28} className="mx-auto mb-3 opacity-50" />
              No scene time logged yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

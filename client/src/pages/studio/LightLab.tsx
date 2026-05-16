import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ToolSurface, ToolWorkspace } from "@/components/layout/tool-workspace";
import type { Project } from "@shared/schema";
import { ArrowLeft, Check, CloudRain, CloudSun, Compass, Copy, MapPinned, RotateCcw, Sparkles, SunMedium, Sunrise, Sunset, Wind } from "lucide-react";
import {
  LIGHT_MOODS,
  SEASONS,
  buildLightingPlan,
  buildSunPathSamples,
  computeSunPosition,
  rankHdriLocations,
  type Season,
  type WeatherMood,
} from "./light-lab-model";

type ProjectDetail = {
  project: Project;
};

const DEFAULT_STATE = {
  hour: 18,
  season: "autumn" as Season,
  cloudCover: 20,
  mood: "golden" as WeatherMood,
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export default function LightLab() {
  const params = useParams() as { id: string };
  const projectId = parseInt(params.id, 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data } = useQuery<ProjectDetail>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}`);
      return res.json();
    },
  });

  const [hour, setHour] = useState(DEFAULT_STATE.hour);
  const [season, setSeason] = useState<Season>(DEFAULT_STATE.season);
  const [cloudCover, setCloudCover] = useState(DEFAULT_STATE.cloudCover);
  const [mood, setMood] = useState<WeatherMood>(DEFAULT_STATE.mood);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const plan = useMemo(() => buildLightingPlan({ hour, season, cloudCover, mood }), [hour, season, cloudCover, mood]);
  const sunPath = useMemo(() => buildSunPathSamples(season), [season]);
  const rankedLocations = useMemo(() => rankHdriLocations({ hour, season, cloudCover, mood }), [hour, season, cloudCover, mood]);

  useEffect(() => {
    if (selectedLocationId && rankedLocations.some((location) => location.id === selectedLocationId)) {
      return;
    }
    setSelectedLocationId(rankedLocations[0]?.id ?? "");
  }, [rankedLocations, selectedLocationId]);

  const selectedLocation = rankedLocations.find((location) => location.id === selectedLocationId) ?? rankedLocations[0];
  const selectedMood = LIGHT_MOODS.find((entry) => entry.value === mood) ?? LIGHT_MOODS[0];
  const seasonName = SEASONS.find((entry) => entry.value === season)?.label ?? season;
  const sunPosition = computeSunPosition(hour, season, cloudCover);

  const handleCopyPlan = async () => {
    const text = [
      data?.project.title || `Project ${projectId}`,
      `${seasonName} / ${selectedMood.label}`,
      plan.summary,
      selectedLocation ? `HDRI: ${selectedLocation.name} (${selectedLocation.region})` : "HDRI: none selected",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Lighting plan copied" });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access.", variant: "destructive" });
    }
  };

  const handleReset = () => {
    setHour(DEFAULT_STATE.hour);
    setSeason(DEFAULT_STATE.season);
    setCloudCover(DEFAULT_STATE.cloudCover);
    setMood(DEFAULT_STATE.mood);
    toast({ title: "Lighting reset" });
  };

  return (
    <ToolWorkspace
      className="max-w-7xl mx-auto"
      backAction={
        <Button variant="ghost" size="sm" onClick={() => setLocation(`/projects/${projectId}`)} data-testid="button-back">
          <ArrowLeft size={16} className="mr-1" /> Back to project
        </Button>
      }
      title="Light Lab"
      icon={<SunMedium size={20} className="text-primary" />}
      badge={<span className="chip chip-sky">Lighting</span>}
      meta={
        <>
          <span>{data?.project.title || `Project ${projectId}`}</span>
          <span>•</span>
          <span>{seasonName} / {selectedMood.label}</span>
          <span>•</span>
          <span>{sunPosition.label}</span>
        </>
      }
      actions={
        <>
          <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-reset-light-lab">
            <RotateCcw size={14} className="mr-1.5" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyPlan} data-testid="button-copy-light-plan">
            <Copy size={14} className="mr-1.5" /> Copy Plan
          </Button>
          <Button size="sm" onClick={() => setLocation(`/projects/${projectId}/video-editor`)} data-testid="button-open-video-editor">
            <Sparkles size={14} className="mr-1.5" /> Open Video Editor
          </Button>
        </>
      }
      main={
        <div className="space-y-6 min-w-0">
          <ToolSurface className="overflow-hidden">
            <div
              className="relative min-h-[420px] p-5 sm:p-6 overflow-hidden"
              style={{ background: `linear-gradient(180deg, ${plan.skyTop} 0%, ${plan.skyBottom} 58%, #0B0E16 100%)` }}
            >
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-10 h-px bg-white/18" />
              <div className="absolute left-5 top-5 right-5 flex items-start justify-between gap-4">
                <div className="max-w-md">
                  <div className="flex items-center gap-2 text-white/90 text-xs uppercase tracking-wider font-medium">
                    <Compass size={12} /> {data?.project.title || `Project ${projectId}`}
                  </div>
                  <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">Preview the lighting before the shot leaves layout.</h2>
                  <p className="mt-2 text-sm sm:text-base text-white/80 max-w-lg">{plan.summary}</p>
                </div>
                <div className="shrink-0 rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-right text-white backdrop-blur-sm">
                  <div className="text-[10px] uppercase tracking-widest text-white/60">Selected time</div>
                  <div className="mt-1 text-lg font-semibold">{sunPosition.label}</div>
                  <div className="text-xs text-white/70">{seasonName} / {selectedMood.label}</div>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 h-64">
                <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                  <defs>
                    <linearGradient id="light-lab-path" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.48)" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M 8 78 C 22 52, 36 ${sunPosition.y > 60 ? 34 : 28}, 50 ${sunPosition.y} C 64 ${sunPosition.y > 60 ? 28 : 34}, 78 52, 92 78`}
                    fill="none"
                    stroke="url(#light-lab-path)"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                    opacity="0.9"
                  />
                  {sunPath.map((point) => (
                    <circle
                      key={`${point.hour}`}
                      cx={point.x}
                      cy={point.y}
                      r={Math.abs(point.hour - hour) < 0.1 ? 1.9 : 1.1}
                      fill={Math.abs(point.hour - hour) < 0.1 ? plan.sunColor : "rgba(255,255,255,0.45)"}
                      stroke="rgba(255,255,255,0.45)"
                      strokeWidth="0.4"
                    />
                  ))}
                </svg>

                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${sunPosition.x}%`, top: `${sunPosition.y}%` }}
                >
                  <div
                    className="h-20 w-20 rounded-full blur-2xl"
                    style={{ backgroundColor: plan.sunColor, opacity: 0.45 }}
                  />
                  <div
                    className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50 shadow-[0_0_40px_rgba(255,255,255,0.35)]"
                    style={{ backgroundColor: plan.sunColor }}
                  />
                </div>
              </div>

              <div className="absolute inset-x-5 bottom-5 flex flex-wrap gap-2">
                <Badge label={plan.moodLabel} icon={<SunMedium size={12} />} />
                <Badge label={`${plan.kelvin}K`} icon={<Sparkles size={12} />} />
                <Badge label={`${plan.shadowSoftness}% shadows`} icon={<Wind size={12} />} />
                <Badge label={`${formatPercent(cloudCover)} cloud cover`} icon={<CloudRain size={12} />} />
              </div>
            </div>
          </ToolSurface>

          <ToolSurface className="p-5 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display font-semibold">Light Controls</h3>
                <p className="text-sm text-muted-foreground">Tighten the key light, cloud cover, and weather mood.</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>{plan.note}</div>
                <div className="mt-1">Exposure bias {plan.exposureBias >= 0 ? "+" : ""}{plan.exposureBias.toFixed(2)} stops</div>
              </div>
            </div>

            <ControlRow
              icon={<Sunrise size={14} />}
              label="Hour"
              value={sunPosition.label}
              hint="Move the sun through the day"
            >
              <Slider value={[hour]} min={0} max={23.5} step={0.5} onValueChange={([value]) => setHour(value ?? hour)} />
            </ControlRow>

            <ControlRow
              icon={<CloudSun size={14} />}
              label="Cloud cover"
              value={formatPercent(cloudCover)}
              hint="More cloud means softer edges and cooler fill"
            >
              <Slider value={[cloudCover]} min={0} max={100} step={1} onValueChange={([value]) => setCloudCover(value ?? cloudCover)} />
            </ControlRow>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <SunMedium size={12} /> Season
                </div>
                <div className="flex flex-wrap gap-2">
                  {SEASONS.map((entry) => (
                    <Button
                      key={entry.value}
                      variant={entry.value === season ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSeason(entry.value)}
                      className="h-8"
                    >
                      {entry.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <SunMedium size={12} /> Weather mood
                </div>
                <div className="flex flex-wrap gap-2">
                  {LIGHT_MOODS.map((entry) => (
                    <Button
                      key={entry.value}
                      variant={entry.value === mood ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMood(entry.value)}
                      className="h-8"
                    >
                      {entry.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </ToolSurface>
        </div>
      }
      aside={
        <>
          <Card className="border-card-border bg-background/84">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MapPinned size={14} className="text-primary" /> HDRI Location Scouter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rankedLocations.map((location, index) => {
                const active = location.id === selectedLocation?.id;
                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => setSelectedLocationId(location.id)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                    data-testid={`button-hdri-location-${location.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 h-10 w-10 shrink-0 rounded-md border"
                        style={{ background: `linear-gradient(180deg, ${location.sky} 0%, ${location.sun} 100%)` }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm truncate">{location.name}</div>
                          {index === 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                              <Check size={10} /> Best match
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{location.region}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">{location.reason}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {location.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold">{location.score}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">score</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-card-border bg-background/84">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Compass size={14} className="text-primary" /> Working Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Current plan</div>
                <div className="mt-1 font-medium">{plan.summary}</div>
                <div className="mt-1 text-xs text-muted-foreground">{plan.note}</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected HDRI</div>
                <div className="mt-1 font-medium">{selectedLocation?.name ?? "None selected"}</div>
                <div className="mt-1 text-xs text-muted-foreground">{selectedLocation?.note ?? "Pick a location from the scouter."}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sunset size={13} /> Best for late-day continuity passes and shot-to-shot matching.
              </div>
            </CardContent>
          </Card>
        </>
      }
    />
  );
}

function Badge({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
      {icon}
      {label}
    </span>
  );
}

function ControlRow({
  icon,
  label,
  value,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {icon} {label}
          </div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
      {children}
    </div>
  );
}

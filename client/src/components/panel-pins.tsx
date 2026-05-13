// v4 Panel pin comments — time-coded positional annotations
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, X, Pin } from "lucide-react";
import { initials } from "@/lib/utils-cel";

interface PinData {
  id: number;
  panelId: number;
  xPercent: number;
  yPercent: number;
  body: string;
  authorId: number;
  createdAt: string;
  author?: { id: number; name: string; avatarColor: string } | null;
}

interface PanelPinsProps {
  panelId: number;
  pinMode: boolean;
  readOnly?: boolean;
}

export function PanelPinsOverlay({ panelId, pinMode, readOnly = false }: PanelPinsProps) {
  const { data: pins = [] } = useQuery<PinData[]>({
    queryKey: ["/api/panels", panelId, "pins"],
    queryFn: async () => (await apiRequest("GET", `/api/panels/${panelId}/pins`)).json(),
  });
  const { toast } = useToast();
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [openPinId, setOpenPinId] = useState<number | null>(null);

  const createPin = useMutation({
    mutationFn: async (data: { xPercent: number; yPercent: number; body: string }) =>
      (await apiRequest("POST", `/api/panels/${panelId}/pins`, data)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/panels", panelId, "pins"] });
      setPendingPin(null);
      setDraftBody("");
      toast({ title: "Pin added" });
    },
  });

  const deletePin = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/pins/${id}`)).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/panels", panelId, "pins"] }),
  });

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinMode || readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setDraftBody("");
  };

  return (
    <div
      className="absolute inset-0"
      style={{ cursor: pinMode && !readOnly ? "crosshair" : "default" }}
      onClick={handleImageClick}
    >
      {/* Existing pins */}
      {pins.map((pin, i) => (
        <Popover
          key={pin.id}
          open={openPinId === pin.id}
          onOpenChange={(v) => setOpenPinId(v ? pin.id : null)}
        >
          <PopoverTrigger asChild>
            <button
              className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: `${pin.xPercent}%`, top: `${pin.yPercent}%` }}
              onClick={(e) => e.stopPropagation()}
              data-testid={`pin-badge-${pin.id}`}
            >
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-white/60 hover:scale-110 transition-transform">
                {i + 1}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" className="w-56 p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              {pin.author && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ backgroundColor: pin.author.avatarColor }}
                  >
                    {initials(pin.author.name)}
                  </span>
                  {pin.author.name}
                </div>
              )}
              {!readOnly && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 text-destructive"
                  onClick={(e) => { e.stopPropagation(); deletePin.mutate(pin.id); setOpenPinId(null); }}
                  data-testid={`button-delete-pin-${pin.id}`}
                >
                  <X size={10} />
                </Button>
              )}
            </div>
            <p className="text-sm leading-relaxed">{pin.body}</p>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {new Date(pin.createdAt).toLocaleString()}
            </p>
          </PopoverContent>
        </Popover>
      ))}

      {/* Pending pin creation */}
      {pendingPin && (
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
          style={{ left: `${pendingPin.x}%`, top: `${pendingPin.y}%` }}
          onClick={(e) => e.stopPropagation()}
        >
          <Popover open onOpenChange={(v) => { if (!v) setPendingPin(null); }}>
            <PopoverTrigger asChild>
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-white/60 cursor-default">
                <Pin size={8} />
              </span>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-56 p-3">
              <p className="text-xs font-medium mb-2">Add note</p>
              <Textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="Type your note…"
                rows={3}
                className="text-sm mb-2"
                autoFocus
                data-testid="textarea-pin-body"
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setPendingPin(null); setDraftBody(""); }
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    if (!draftBody.trim()) return;
                    createPin.mutate({ xPercent: Math.round(pendingPin.x), yPercent: Math.round(pendingPin.y), body: draftBody });
                  }}
                  disabled={!draftBody.trim() || createPin.isPending}
                  data-testid="button-save-pin"
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setPendingPin(null); setDraftBody(""); }}>
                  Cancel
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

export function PinModeToggle({ panelId, pinMode, onToggle }: { panelId: number; pinMode: boolean; onToggle: () => void }) {
  const { data: pins = [] } = useQuery<PinData[]>({
    queryKey: ["/api/panels", panelId, "pins"],
    queryFn: async () => (await apiRequest("GET", `/api/panels/${panelId}/pins`)).json(),
  });

  return (
    <Button
      size="sm"
      variant={pinMode ? "default" : "outline"}
      onClick={onToggle}
      className="gap-1.5"
      data-testid="button-pin-mode-toggle"
    >
      <MapPin size={13} />
      Pins{pins.length > 0 && <span className="text-[10px] bg-background/20 px-1 rounded-full">{pins.length}</span>}
    </Button>
  );
}

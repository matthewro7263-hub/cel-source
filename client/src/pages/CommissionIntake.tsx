import { useState, useRef } from "react";
import { useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { GlassButton } from "@/components/ui/glass-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Upload, CheckCircle } from "lucide-react";

const COMMISSION_TYPES = ["Character art", "Animation - 2D", "Animation - 3D", "Storyboard", "Other"];
const BUDGET_RANGES = ["Under $50", "$50-$150", "$150-$500", "$500+", "Discuss"];

export default function CommissionIntake() {
  const params = useParams() as { userId: string };
  const userId = parseInt(params.userId, 10);

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [budgetRange, setBudgetRange] = useState("");
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refFilename, setRefFilename] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError("Reference image must be under 10MB.");
      return;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    setRefImage(data);
    setRefFilename(file.name);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientEmail || !type || !description || !budgetRange) {
      setError("Please fill in all required fields.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/commissions", {
        ownerUserId: userId,
        clientName,
        clientEmail,
        type,
        description,
        referenceImage: refImage ?? null,
        deadline: deadline || null,
        budgetRange,
        status: "new",
        notes: "",
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: "linear-gradient(135deg, #0f0c1e 0%, #1a1130 50%, #0c1520 100%)" }}
      >
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-5 ring-4 ring-emerald-500/15">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <h2 className="font-display text-xl font-bold text-white mb-2 tracking-tight">Request sent!</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Got it — the artist will be in touch soon.
            <br />You'll hear back at <span className="text-white/80 font-medium">{clientEmail}</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0f0c1e 0%, #1a1130 50%, #0c1520 100%)" }}
    >
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #6E4FE8 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #4FA8FF 0%, transparent 70%)" }} />
      </div>

      <div className="relative max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-primary" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="font-display font-bold text-white text-lg tracking-tight">Cel</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-display tracking-tight mb-2">Commission request</h1>
          <p className="text-white/50 text-sm">Fill in the details below and the artist will get back to you.</p>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Your name <span className="text-red-400">*</span></Label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Alex Johnson"
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-primary/40"
                  data-testid="input-client-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Email <span className="text-red-400">*</span></Label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="alex@example.com"
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-primary/40"
                  data-testid="input-client-email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Commission type <span className="text-red-400">*</span></Label>
              <Select value={type} onValueChange={setType} required>
                <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-commission-type">
                  <SelectValue placeholder="Choose a type…" />
                </SelectTrigger>
                <SelectContent>
                  {COMMISSION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">What you're looking for <span className="text-red-400">*</span></Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your commission in as much detail as you like — style, characters, length, mood, references…"
                rows={5}
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-primary/40 resize-none"
                data-testid="input-commission-description"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Budget <span className="text-red-400">*</span></Label>
                <Select value={budgetRange} onValueChange={setBudgetRange} required>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-budget">
                    <SelectValue placeholder="Select range…" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGET_RANGES.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70 text-xs">Desired deadline</Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="bg-white/5 border-white/10 text-white focus-visible:ring-primary/40"
                  data-testid="input-commission-deadline"
                />
              </div>
            </div>

            {/* Reference image */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-xs">Reference image (optional)</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {refImage ? (
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <img src={refImage} alt="Reference" className="h-10 w-10 object-cover rounded" />
                  <span className="text-xs text-white/60 flex-1 truncate">{refFilename}</span>
                  <button type="button" onClick={() => { setRefImage(null); setRefFilename(""); }} className="text-white/40 hover:text-white/70">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/3 py-4 text-xs text-white/40 hover:text-white/60 hover:border-white/25 transition-colors"
                  data-testid="button-upload-ref"
                >
                  <Upload size={14} /> Upload reference image (max 10MB)
                </button>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-xs rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">{error}</p>
            )}

            <GlassButton
              type="submit"
              variant="primary"
              size="pill"
              className="w-full"
              disabled={submitting}
              data-testid="button-submit-commission"
            >
              {submitting ? "Sending…" : "Send request"}
            </GlassButton>
          </form>
        </div>

        <p className="text-center text-white/25 text-xs mt-5">
          Powered by Cel — animation production hub
        </p>
      </div>
    </div>
  );
}

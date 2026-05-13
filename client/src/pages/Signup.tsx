import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CelLogo } from "@/components/CelLogo";
import { GlassButton } from "@/components/ui/glass-button";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const { applyToken } = useAuth();

  const m = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/auth/signup", { name, email, password });
      return r.json();
    },
    onSuccess: async (data: { user: any; token: string }) => {
      applyToken(data.token, data.user);
      // Defer navigation one tick so applyToken's state update commits before
      // ProtectedShell evaluates `user` — same race that affected login.
      setTimeout(() => setLocation("/dashboard"), 0);
    },
    onError: (err: any) => {
      toast({ title: "Couldn't create account", description: String(err.message || err), variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background relative overflow-hidden">
      {/* Atmosphere blobs */}
      <div className="blob blob-lavender" />
      <div className="blob blob-peach" />
      <div className="blob blob-sky" />
      <div className="dot-grid" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center justify-center mb-8 text-primary">
          <CelLogo size={48} />
        </div>
        <h1 className="font-display text-2xl font-bold text-center mb-1.5 tracking-tight">Create your Cel account</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Free for solo animators and small teams.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
          className="glass rounded-2xl p-7 space-y-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">Your name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-name" className="glass-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-email" className="glass-input" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} data-testid="input-password" className="glass-input" />
            <p className="text-xs text-muted-foreground">At least 8 characters. Stored with salted scrypt hashing — we never see your password.</p>
          </div>
          <GlassButton
            type="submit"
            variant="primary"
            size="pill"
            className="w-full"
            disabled={m.isPending}
            data-testid="button-signup"
          >
            {m.isPending ? "Creating…" : "Create account"}
          </GlassButton>
          <p className="text-xs text-muted-foreground text-center pt-1">
            Have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CelLogo } from "@/components/CelLogo";
import { MetalGlassButton } from "@/components/ui/metal-glass-button";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("matthew@cel.app");
  const [password, setPassword] = useState("celdemo");
  const [showPass, setShowPass] = useState(false);
  const { toast } = useToast();
  const { applyToken } = useAuth();

  const m = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/auth/login", { email, password });
      return r.json();
    },
    onSuccess: async (data: { user: any; token: string }) => {
      applyToken(data.token, data.user);
      // Defer navigation to next tick so React commits the AuthProvider state
      // update (tokenUser) BEFORE wouter re-renders ProtectedShell. Without
      // this, ProtectedShell can mount with stale user=null and bounce back
      // to /login — the classic "double-click sign in" race.
      setTimeout(() => setLocation("/dashboard"), 0);
    },
    onError: (err: any) => {
      toast({ title: "Couldn't sign in", description: String(err.message || err), variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background relative overflow-hidden">
      {/* Atmosphere blobs */}
      <div className="blob blob-lavender" />
      <div className="blob blob-peach" />
      <div className="blob blob-sky" />
      {/* Dot grid overlay */}
      <div className="dot-grid" />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex items-center justify-center mb-8 text-primary">
          <CelLogo size={48} />
        </div>
        <h1 className="font-display text-2xl font-bold text-center mb-1.5 tracking-tight">Welcome back to Cel</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          The production hub for animators.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
          className="glass rounded-2xl p-7 space-y-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-email"
              className="glass-input"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
                className="glass-input pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {/* Login button: noMetal because the parent .glass form uses
              backdrop-filter, which clips metal-fx's outer glow. The flat
              glass button alone looks crisp inside the frosted card. */}
          <MetalGlassButton
            type="submit"
            variant="primary"
            size="pill"
            noMetal
            className="w-full"
            disabled={m.isPending}
            data-testid="button-login"
          >
            {m.isPending ? "Signing in…" : "Sign in"}
          </MetalGlassButton>
          <p className="text-xs text-muted-foreground text-center pt-1">
            New here?{" "}
            <Link href="/signup" className="text-primary font-medium hover:underline" data-testid="link-signup">
              Create an account
            </Link>
          </p>
        </form>

        <p className="text-[11px] text-muted-foreground text-center mt-5 font-mono">
          Demo: matthew@cel.app / celdemo
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { hashQueryParam } from "@/lib/hashQuery";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MetalGlassButton } from "@/components/ui/metal-glass-button";
import { AuthLayout } from "@/components/AuthLayout";

/** Also the landing page for invite emails: invited people choose their first password here. */
export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const token = hashQueryParam("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { toast } = useToast();

  const reset = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/reset-password", { token, password })).json(),
    onSuccess: () => {
      toast({ title: "Password updated", description: "Sign in with your new password." });
      setLocation("/login");
    },
  });

  if (!token) {
    return (
      <AuthLayout title="This link is incomplete">
        <p className="text-sm text-center">The reset link is missing its token. Open the link from your email again, or request a new one.</p>
        <p className="text-xs text-center">
          <Link href="/forgot-password" className="text-primary font-medium hover:underline">Request a new link</Link>
        </p>
      </AuthLayout>
    );
  }

  const mismatch = confirm.length > 0 && confirm !== password;
  const invalidLink = reset.isError && (reset.error as any)?.status === 400 && /invalid or has expired/.test(String((reset.error as any).message));

  return (
    <AuthLayout title="Choose a new password" subtitle="Pick something you don't use anywhere else.">
      {invalidLink ? (
        <div className="space-y-3 text-center" data-testid="reset-expired">
          <p className="text-sm">This link has expired or was already used.</p>
          <Link href="/forgot-password" className="text-primary text-sm font-medium hover:underline">Request a new link</Link>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (!mismatch) reset.mutate(); }} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">New password (8+ characters)</Label>
            <Input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input" required data-testid="input-reset-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-sm font-medium">Confirm password</Label>
            <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="glass-input" required data-testid="input-reset-confirm" />
            {mismatch && <p className="text-xs text-destructive">Passwords don't match.</p>}
          </div>
          {reset.isError && !invalidLink && (
            <p className="text-xs text-destructive" role="alert">{String((reset.error as any)?.message ?? reset.error)}</p>
          )}
          <MetalGlassButton type="submit" variant="primary" size="pill" noMetal className="w-full" disabled={reset.isPending || password.length < 8 || mismatch} data-testid="button-reset-submit">
            {reset.isPending ? "Saving…" : "Set password"}
          </MetalGlassButton>
        </form>
      )}
    </AuthLayout>
  );
}

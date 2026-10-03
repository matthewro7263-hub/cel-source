import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAppConfig } from "@/lib/config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MetalGlassButton } from "@/components/ui/metal-glass-button";
import { AuthLayout } from "@/components/AuthLayout";
import { MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const { data: config } = useAppConfig();
  const { toast } = useToast();

  const send = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/forgot-password", { email })).json(),
    onError: (err: any) => toast({ title: "Couldn't send the email", description: String(err.message || err), variant: "destructive" }),
  });

  if (send.isSuccess) {
    return (
      <AuthLayout title="Check your email">
        <div className="text-center space-y-3" data-testid="forgot-sent">
          <MailCheck className="mx-auto text-primary" size={32} />
          <p className="text-sm">
            If an account exists for <strong>{email}</strong>, we've sent a link to choose a new password. It works once and expires in an hour.
          </p>
          <p className="text-xs text-muted-foreground">Nothing there? Check spam, or wait a minute and try again.</p>
        </div>
        <p className="text-xs text-center">
          <Link href="/login" className="text-primary font-medium hover:underline">Back to sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      {config && !config.emailEnabled && (
        <p className="text-xs rounded-md border border-amber-500/40 bg-amber-500/10 p-3" data-testid="forgot-no-email">
          This server isn't set up to send email yet, so reset links can't be delivered. Ask whoever runs this Cel workspace to reset your password.
        </p>
      )}
      <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="glass-input" required data-testid="input-forgot-email" />
        </div>
        <MetalGlassButton type="submit" variant="primary" size="pill" noMetal className="w-full" disabled={send.isPending || !email} data-testid="button-forgot-send">
          {send.isPending ? "Sending…" : "Send reset link"}
        </MetalGlassButton>
      </form>
      <p className="text-xs text-center">
        <Link href="/login" className="text-primary font-medium hover:underline">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}

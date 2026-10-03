import { useState } from "react";
import { useLocation } from "wouter";
import { ApiError } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils-cel";

const COLORS = ["#6E4FE8", "#E8744F", "#4FBFE8", "#E84F9F", "#4FE89A", "#E8C44F", "#E84F4F", "#4F6FE8"];

export default function ProfileSettings() {
  const { user, applyToken, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [color, setColor] = useState(user?.avatarColor || COLORS[0]);
  const { toast } = useToast();

  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", "/api/auth/me", { name, avatarColor: color })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile saved" });
    },
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const changePassword = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/password", { currentPassword, newPassword })).json() as Promise<{ token: string }>,
    onSuccess: ({ token }) => {
      // Other devices are signed out; keep this one signed in with the fresh token.
      if (user) applyToken(token, user);
      setCurrentPassword("");
      setNewPassword("");
      toast({ title: "Password changed", description: "Other devices have been signed out." });
    },
    onError: (err) => toast({ title: "Couldn't change password", description: err instanceof ApiError ? err.message : String(err), variant: "destructive" }),
  });
  const setNotifications = useMutation({
    mutationFn: async (emailNotifications: boolean) => (await apiRequest("PATCH", "/api/auth/me", { emailNotifications })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
    onError: (err) => toast({ title: "Couldn't save", description: err instanceof ApiError ? err.message : String(err), variant: "destructive" }),
  });

  const [, setLocation] = useLocation();
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const deleteAccount = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", "/api/auth/me", { password: deletePassword, confirmEmail: deleteEmail })).json(),
    onSuccess: () => {
      queryClient.clear();
      logout();
      setLocation("/");
      toast({ title: "Account deleted", description: "Your projects and data have been removed." });
    },
    onError: (err) => toast({ title: "Couldn't delete account", description: err instanceof ApiError ? err.message : String(err), variant: "destructive" }),
  });

  const signOutEverywhere = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/auth/logout-all"); },
    onSuccess: () => logout(),
  });

  if (!user) return null;

  return (
    <div className="px-6 lg:px-10 py-8 lg:py-12 max-w-2xl mx-auto">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Profile</p>
        <h1 className="font-display text-xl font-bold tracking-tight">Your settings</h1>
      </div>

      <div className="space-y-5">
        <div className="glass p-5">
          <h3 className="font-display font-semibold mb-4">Identity</h3>
          <div className="flex items-center gap-4 mb-5">
            <Avatar className="h-14 w-14">
              <AvatarFallback style={{ backgroundColor: color, color: "white" }} className="text-lg font-semibold">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-display font-semibold">{name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} data-testid="input-profile-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Avatar color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    data-testid={`button-avatar-color-${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-profile">
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>

        <div className="glass p-5">
          <h3 className="font-display font-semibold mb-4">Security</h3>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} data-testid="input-current-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password (8+ characters)</Label>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} data-testid="input-new-password" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={() => signOutEverywhere.mutate()} disabled={signOutEverywhere.isPending} data-testid="button-signout-everywhere">
                Sign out everywhere
              </Button>
              <Button type="submit" disabled={changePassword.isPending || !currentPassword || newPassword.length < 8} data-testid="button-change-password">
                {changePassword.isPending ? "Changing…" : "Change password"}
              </Button>
            </div>
          </form>
        </div>

        <div className="glass p-5">
          <h3 className="font-display font-semibold mb-1">Notifications</h3>
          <p className="text-xs text-muted-foreground mb-4">Security emails (password resets and changes) are always sent.</p>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="email-notifications" className="text-sm">Email me about new commission requests</Label>
            <Switch
              id="email-notifications"
              checked={user.emailNotifications !== false}
              onCheckedChange={(checked) => setNotifications.mutate(checked)}
              disabled={setNotifications.isPending}
              data-testid="switch-email-notifications"
            />
          </div>
        </div>

        <div className="glass p-5 border border-destructive/30">
          <h3 className="font-display font-semibold mb-1 text-destructive">Delete account</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Permanently deletes your account, every project you own (including ones shared with others), your commissions and uploads. This can't be undone.
          </p>
          <AlertDialog onOpenChange={(open) => { if (!open) { setDeletePassword(""); setDeleteEmail(""); } }}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive border-destructive/40" data-testid="button-delete-account">Delete my account…</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  Everything you own will be permanently removed. Projects you were invited to stay with their owners; comments you left there will show as "Deleted user".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="delete-email">Type your email ({user.email}) to confirm</Label>
                  <Input id="delete-email" autoComplete="off" value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} data-testid="input-delete-email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="delete-password">Password</Label>
                  <Input id="delete-password" type="password" autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} data-testid="input-delete-password" />
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteAccount.isPending || !deletePassword || deleteEmail.trim().toLowerCase() !== user.email.toLowerCase()}
                  onClick={(e) => { e.preventDefault(); deleteAccount.mutate(); }}
                  data-testid="button-confirm-delete-account"
                >
                  {deleteAccount.isPending ? "Deleting…" : "Delete everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

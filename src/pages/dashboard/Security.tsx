import { useState } from "react";
import { KeyRound, LogOut, ShieldAlert, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardPageHeader, StatusBadge } from "@/components/dashboard/DashboardPageHeader";
import { useToast } from "@/hooks/use-toast";
import { passwordStrength, friendlyAuthError } from "@/lib/auth-helpers";

export default function DashboardSecurity() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const strength = passwordStrength(pw);

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (pw !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) {
      toast({ title: "Could not update", description: friendlyAuthError(error.message), variant: "destructive" });
      return;
    }
    setPw("");
    setConfirm("");
    toast({ title: "Password updated", description: "Use your new password next time you sign in." });
  };

  const signOutEverywhere = async () => {
    await supabase.auth.signOut({ scope: "global" });
    await signOut();
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader title="Security" description="Manage your password and active sessions." />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" aria-hidden="true" /> Email
          </CardTitle>
          <StatusBadge tone={user?.email_confirmed_at ? "success" : "warning"}>
            {user?.email_confirmed_at ? "Verified" : "Unverified"}
          </StatusBadge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" /> Change password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={updatePassword} className="max-w-sm space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              {pw && <p className="text-xs text-muted-foreground">Strength: {strength.label}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-primary" aria-hidden="true" /> Sessions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Signing out everywhere ends your session on all devices and browsers.
          </p>
          <Button variant="outline" onClick={signOutEverywhere}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out everywhere
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

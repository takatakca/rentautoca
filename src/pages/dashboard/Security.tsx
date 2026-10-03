import { useEffect, useState } from "react";
import { KeyRound, LogOut, ShieldAlert, Mail, Phone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardPageHeader, StatusBadge } from "@/components/dashboard/DashboardPageHeader";
import { useToast } from "@/hooks/use-toast";
import { passwordStrength, friendlyAuthError } from "@/lib/auth-helpers";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { bootstrapRentautoFromTakatak, normalizeTakatakPhone } from "@/lib/takatak-phone-auth";

export default function DashboardSecurity() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [phoneInput, setPhoneInput] = useState(user?.phone ?? "");
  const [pendingPhone, setPendingPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneStage, setPhoneStage] = useState<"idle" | "otp">("idle");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const strength = passwordStrength(pw);

  useEffect(() => {
    if (phoneStage === "idle") setPhoneInput(user?.phone ?? "");
  }, [phoneStage, user?.phone]);

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

  const requestPhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();

    const phone = normalizeTakatakPhone(phoneInput);
    if (!phone) {
      toast({
        title: "Invalid mobile number",
        description: "Enter a valid mobile number with area code or country code.",
        variant: "destructive",
      });
      return;
    }

    if (phone === user?.phone) {
      toast({ title: "This number is already on your TAKATAK identity." });
      return;
    }

    setPhoneSaving(true);
    const { error } = await supabase.auth.updateUser({ phone });
    setPhoneSaving(false);

    if (error) {
      toast({
        title: "Could not send verification code",
        description: friendlyAuthError(error.message),
        variant: "destructive",
      });
      return;
    }

    setPendingPhone(phone);
    setPhoneOtp("");
    setPhoneStage("otp");
    toast({
      title: "Verification code sent",
      description: `Enter the 6-digit TAKATAK code sent to ${phone}.`,
    });
  };

  const verifyPhoneChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pendingPhone || phoneOtp.length !== 6) {
      toast({
        title: "Enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setPhoneSaving(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone: pendingPhone,
      token: phoneOtp,
      type: "phone_change",
    });

    if (verifyError) {
      setPhoneSaving(false);
      toast({
        title: "Verification failed",
        description: friendlyAuthError(verifyError.message),
        variant: "destructive",
      });
      return;
    }

    const { error: bootstrapError } = await bootstrapRentautoFromTakatak();
    await supabase.auth.refreshSession();
    setPhoneSaving(false);

    if (bootstrapError) {
      toast({
        title: "Phone verified, TAKATAK sync needs attention",
        description:
          "The mobile number was verified, but the shared identity could not be reconciled automatically. Contact support before making a booking.",
        variant: "destructive",
      });
      return;
    }

    setPhoneStage("idle");
    setPhoneOtp("");
    setPendingPhone("");
    setPhoneInput(pendingPhone);

    toast({
      title: "Mobile number verified",
      description: "Your TAKATAK identity and Rentauto profile are synchronized.",
    });
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
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-4 w-4 text-primary" aria-hidden="true" /> TAKATAK mobile
          </CardTitle>
          <StatusBadge tone={user?.phone_confirmed_at ? "success" : "warning"}>
            {user?.phone_confirmed_at ? "Verified" : "Verification required"}
          </StatusBadge>
        </CardHeader>
        <CardContent>
          {phoneStage === "idle" ? (
            <form onSubmit={requestPhoneChange} className="max-w-sm space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="security-phone">Mobile number</Label>
                <Input
                  id="security-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  placeholder="+1 514 555 0123"
                />
                <p className="text-xs text-muted-foreground">
                  Changing this number requires a new SMS verification. A profile edit can never carry verification to another number.
                </p>
              </div>
              <Button type="submit" variant="outline" disabled={phoneSaving}>
                {phoneSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {user?.phone ? "Change and verify mobile" : "Add and verify mobile"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyPhoneChange} className="max-w-sm space-y-4">
              <p className="text-sm text-muted-foreground">
                Code sent to {pendingPhone}
              </p>
              <InputOTP
                maxLength={6}
                value={phoneOtp}
                onChange={setPhoneOtp}
                inputMode="numeric"
                autoComplete="one-time-code"
                disabled={phoneSaving}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={phoneSaving || phoneOtp.length !== 6}>
                  {phoneSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify new mobile
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={phoneSaving}
                  onClick={() => {
                    setPhoneStage("idle");
                    setPendingPhone("");
                    setPhoneOtp("");
                    setPhoneInput(user?.phone ?? "");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
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

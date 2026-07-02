import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { friendlyAuthError } from "@/lib/auth-helpers";

const RESEND_COOLDOWN = 45;

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const initialEmail = params.get("email") ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !/^\d{6}$/.test(token)) return setError("Enter your email and the 6-digit code from your inbox.");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    setLoading(false);
    if (error) return setError(friendlyAuthError(error.message));
    setSuccess(true);
    const hostIntent = sessionStorage.getItem("rentauto_host_intent") === "1";
    sessionStorage.removeItem("rentauto_host_intent");
    setTimeout(() => navigate(hostIntent ? "/become-host" : "/", { replace: true }), 1200);
  };

  const resend = async () => {
    if (!email.trim()) return setError("Enter your email first.");
    setResending(true);
    setError(null);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    setResending(false);
    if (error) return setError(friendlyAuthError(error.message));
    setCooldown(RESEND_COOLDOWN);
  };

  if (success) {
    return (
      <AuthShell title="Email verified" description="You're all set. Redirecting you now…">
        <div className="flex justify-center py-4"><MailCheck className="h-12 w-12 text-primary" /></div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verify your email"
      description={email ? `We sent a 6-digit code to ${email}. Enter it below to activate your account.` : "Enter the 6-digit code we emailed you to activate your account."}
      footer={<Link to="/login" className="text-primary hover:underline">Back to login</Link>}
    >
      <form onSubmit={verify} className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {!initialEmail && (
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="token">6-digit code</Label>
          <Input
            id="token" inputMode="numeric" pattern="[0-9]*" maxLength={6}
            autoComplete="one-time-code" placeholder="000000"
            className="text-center text-lg tracking-[0.5em] font-mono"
            value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))} required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify email
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          Didn't get the code?{" "}
          <button type="button" onClick={resend} disabled={resending || cooldown > 0} className="text-primary hover:underline disabled:opacity-60 disabled:no-underline">
            {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

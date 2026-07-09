import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, MailCheck, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { friendlyAuthError, sanitizeRedirect } from "@/lib/auth-helpers";

const RESEND_COOLDOWN = 45;

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const initialEmail = params.get("email") ?? "";
  const redirectParam = sanitizeRedirect(params.get("redirect"));
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

  const submitCode = async (code: string) => {
    setError(null);
    if (!email.trim() || !/^\d{6}$/.test(code)) {
      return setError("Enter your email and the 6-digit code from your inbox.");
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code,
      type: "email",
    });
    setLoading(false);
    if (error) return setError(friendlyAuthError(error.message));
    setSuccess(true);
    const hostIntent = sessionStorage.getItem("rentauto_host_intent") === "1";
    sessionStorage.removeItem("rentauto_host_intent");
    const dest = hostIntent ? "/become-host" : (redirectParam || "/");
    setTimeout(() => navigate(dest, { replace: true }), 1000);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCode(token);
  };

  const onOtpChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 6);
    setToken(clean);
    if (clean.length === 6 && !loading) {
      // auto-submit on full paste/entry
      submitCode(clean);
    }
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
        <div className="flex justify-center py-4">
          <MailCheck className="h-12 w-12 text-primary" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Verify your email"
      description={
        email
          ? `We sent a 6-digit code to ${email}. Enter it below to activate your account.`
          : "Enter the 6-digit code we emailed you to activate your account."
      }
      footer={<Link to="/login" className="text-primary hover:underline">Back to login</Link>}
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        {!initialEmail && (
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>6-digit code</Label>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={token}
              onChange={onOtpChange}
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              disabled={loading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Check your inbox and spam folder for a code from Rentauto.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={loading || token.length !== 6}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Verify email
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          Didn't get the code?{" "}
          <button
            type="button"
            onClick={resend}
            disabled={resending || cooldown > 0}
            className="text-primary hover:underline disabled:opacity-60 disabled:no-underline"
          >
            {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

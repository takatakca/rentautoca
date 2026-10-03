import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AuthShell, GoogleIcon } from "@/components/auth/AuthShell";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ensureProfile, friendlyAuthError, sanitizeRedirect } from "@/lib/auth-helpers";
import {
  normalizeTakatakPhone,
  requestTakatakSmsOtp,
  verifyTakatakSmsOtp,
} from "@/lib/takatak-phone-auth";

type LoginMode = "sms" | "password";

export default function Login() {
  const location = useLocation();
  const requestedMode = new URLSearchParams(location.search).get("mode");
  const [mode, setMode] = useState<LoginMode>(requestedMode === "password" ? "password" : "sms");
  const [phoneInput, setPhoneInput] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleAutoStarted, setGoogleAutoStarted] = useState(false);
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const safeRedirect = sanitizeRedirect(params.get("redirect"));
  const requestedProvider = params.get("provider");
  const fromState = (location.state as { from?: { pathname: string } })?.from?.pathname;
  const from = safeRedirect || sanitizeRedirect(fromState) || "/";
  const isCheckoutRedirect = from.startsWith("/checkout");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const phone = normalizeTakatakPhone(phoneInput);
    if (!phone) return setError("Enter a valid mobile number with area code or country code.");

    setLoading(true);
    const { error: otpError } = await requestTakatakSmsOtp({
      phone,
      shouldCreateUser: false,
    });
    setLoading(false);

    if (otpError) return setError(friendlyAuthError(otpError.message));

    setVerifiedPhone(phone);
    setOtp("");
    setOtpSent(true);
  };

  const handleResendOtp = async () => {
    setError(null);
    setLoading(true);
    const { error: resendError } = await requestTakatakSmsOtp({
      phone: verifiedPhone,
      shouldCreateUser: false,
    });
    setLoading(false);
    if (resendError) setError(friendlyAuthError(resendError.message));
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) return setError("Enter the 6-digit verification code.");

    setLoading(true);
    const { data, error: verifyError } = await verifyTakatakSmsOtp(verifiedPhone, otp);

    if (verifyError || !data.user) {
      setLoading(false);
      return setError(friendlyAuthError(verifyError?.message || "SMS verification failed."));
    }

    await ensureProfile(data.user);
    setLoading(false);
    navigate(from, { replace: true });
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginError || !data.user) {
      setLoading(false);
      return setError(friendlyAuthError(loginError?.message || "Login failed."));
    }

    await ensureProfile(data.user);
    setLoading(false);
    navigate(from, { replace: true });
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      setGoogleLoading(false);
      setError(friendlyAuthError((result.error as Error).message));
      return;
    }
    if (result.redirected) return;
    navigate(from, { replace: true });
  };

  useEffect(() => {
    if (requestedProvider !== "google" || googleAutoStarted) return;
    setGoogleAutoStarted(true);
    void handleGoogle();
    // Run once for an explicit provider deep link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedProvider, googleAutoStarted]);

  const switchMode = (next: LoginMode) => {
    setMode(next);
    setOtpSent(false);
    setOtp("");
    setError(null);
  };

  return (
    <AuthShell
      title={isCheckoutRedirect ? "Sign in to continue to checkout" : "Welcome back"}
      description={isCheckoutRedirect ? "Use your TAKATAK identity to complete your booking securely." : "One TAKATAK identity, with Rentauto access when authorized."}
      footer={
        <>
          New to Rentauto?{" "}
          <Link to="/signup" className="text-primary hover:underline font-medium">Create your TAKATAK identity</Link>
        </>
      }
    >
      <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={googleLoading || loading}>
        {googleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GoogleIcon className="mr-2" />}
        Continue with Google
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={mode === "sms" ? "default" : "outline"} onClick={() => switchMode("sms")} disabled={loading}>
          SMS code
        </Button>
        <Button type="button" variant={mode === "password" ? "default" : "outline"} onClick={() => switchMode("password")} disabled={loading}>
          Existing password
        </Button>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {mode === "sms" ? (
        !otpSent ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">TAKATAK mobile number</Label>
              <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+1 514 555 0123" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send TAKATAK SMS code
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <p className="text-sm text-muted-foreground text-center">Code sent to {verifiedPhone}</p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp} inputMode="numeric">
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => <InputOTPSlot key={index} index={index} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify and sign in
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-primary hover:underline" onClick={() => void handleResendOtp()} disabled={loading}>
                Resend code
              </button>
              <button type="button" className="text-muted-foreground hover:underline" onClick={() => { setOtpSent(false); setOtp(""); }}>
                Change number
              </button>
            </div>
          </form>
        )
      ) : (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
            </div>
            <div className="relative">
              <Input id="password" type={showPw ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1" aria-label={showPw ? "Hide password" : "Show password"}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading || googleLoading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in with existing password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

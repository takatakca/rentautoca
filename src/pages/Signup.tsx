import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { lovable } from "@/integrations/lovable/index";\nimport { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, MessageSquareText } from "lucide-react";
import { AuthShell, GoogleIcon } from "@/components/auth/AuthShell";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { friendlyAuthError, sanitizeRedirect } from "@/lib/auth-helpers";
import {
  bootstrapRentautoFromTakatak,
  normalizeTakatakPhone,
  requestTakatakSmsOtp,
  splitTakatakName,
  verifyTakatakSmsOtp,
  type TakatakSignupMetadata,
} from "@/lib/takatak-phone-auth";

type Step = "details" | "otp";

export default function Signup() {
  const [step, setStep] = useState<Step>("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [hostIntent, setHostIntent] = useState(false);
  const [consentAt, setConsentAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = sanitizeRedirect(new URLSearchParams(location.search).get("redirect"));
  const postAuthDest = hostIntent ? "/become-host" : (redirectParam || "/");

  const metadata = (phone: string, capturedAt: string): TakatakSignupMetadata => {
    const { firstName, lastName } = splitTakatakName(fullName);
    return {
      full_name: fullName.trim(),
      display_name: fullName.trim(),
      first_name: firstName,
      last_name: lastName,
      email: email.trim().toLowerCase(),
      phone,
      source_application: "RENTAUTO",
      host_intent: hostIntent ? "true" : "false",
      rentauto_terms_accepted_at: capturedAt,
      rentauto_privacy_accepted_at: capturedAt,
      rentauto_consent_captured_at: capturedAt,
    };
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      return setError("Please enter your full name.");
    }
    if (!email.trim() || !email.includes("@")) {
      return setError("Please enter a valid email address.");
    }
    if (!acceptTerms) {
      return setError("You must accept the Terms and Privacy Policy to continue.");
    }

    const phone = normalizeTakatakPhone(phoneInput);
    if (!phone) {
      return setError("Enter a valid mobile number with area code or country code.");
    }

    const capturedAt = new Date().toISOString();
    setLoading(true);
    const { error: otpError } = await requestTakatakSmsOtp({
      phone,
      shouldCreateUser: true,
      metadata: metadata(phone, capturedAt),
    });
    setLoading(false);

    if (otpError) return setError(friendlyAuthError(otpError.message));

    setVerifiedPhone(phone);
    setConsentAt(capturedAt);
    setOtp("");
    setStep("otp");
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) return setError("Enter the 6-digit verification code.");

    setLoading(true);
    const { data, error: verifyError } = await verifyTakatakSmsOtp(verifiedPhone, otp);

    if (verifyError || !data.user || !data.session) {
      setLoading(false);
      return setError(friendlyAuthError(verifyError?.message || "SMS verification failed."));
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: metadata(verifiedPhone, consentAt || new Date().toISOString()),
    });

    if (metadataError) {
      setLoading(false);
      return setError("Your phone was verified, but TAKATAK could not finalize your profile.");
    }

    const { error: bootstrapError } = await bootstrapRentautoFromTakatak();
    setLoading(false);

    if (bootstrapError) {
      return setError(
        "TAKATAK could not authorize Rentauto for this identity. If you already use another GROUPE TAKATAK service, log in with that existing account instead of creating another one.",
      );
    }

    if (hostIntent) sessionStorage.setItem("rentauto_host_intent", "1");
    navigate(postAuthDest, { replace: true });
  };

  const handleResend = async () => {
    setError(null);
    setLoading(true);
    const { error: resendError } = await requestTakatakSmsOtp({
      phone: verifiedPhone,
      shouldCreateUser: false,
    });
    setLoading(false);
    if (resendError) setError(friendlyAuthError(resendError.message));
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      setError(friendlyAuthError((result.error as Error).message));
      return;
    }
    if (result.redirected) return;
    navigate(postAuthDest, { replace: true });
  };

  return (
    <AuthShell
      title={step === "otp" ? "Verify your mobile" : "Create your TAKATAK identity"}
      description={
        step === "otp"
          ? `Enter the 6-digit SMS code sent to ${verifiedPhone}.`
          : "One TAKATAK identity connects Rentauto with the services you choose across GROUPE TAKATAK."
      }
      footer={
        <>
          Already use TAKATAK or Rentauto?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">Log in</Link>
        </>
      }
    >
      {step === "details" ? (
        <>
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={googleLoading || loading}>
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GoogleIcon className="mr-2" />}
            Continue with your TAKATAK Google identity
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or verify by SMS</span>
            </div>
          </div>

          <form onSubmit={handleSendOtp} className="space-y-4">
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <Alert>
              <MessageSquareText className="h-4 w-4" />
              <AlertDescription>
                Your login is managed by TAKATAK. Rentauto receives only the identity fields it needs; rental, vehicle, GPS and payment data stay separated.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <p className="text-xs text-muted-foreground">Stored in your TAKATAK master profile. SMS is the verification authority for this signup.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile number</Label>
              <Input id="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+1 514 555 0123" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} required />
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={acceptTerms} onCheckedChange={(v) => setAcceptTerms(v === true)} className="mt-0.5" />
              <span className="text-muted-foreground">
                I agree to the <Link to="/terms" className="text-primary hover:underline">Terms</Link> and{" "}
                <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={hostIntent} onCheckedChange={(v) => setHostIntent(v === true)} className="mt-0.5" />
              <span className="text-muted-foreground">I want to list my car and earn as a host (subject to approval).</span>
            </label>

            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send TAKATAK SMS code
            </Button>
          </form>
        </>
      ) : (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otp} onChange={setOtp} inputMode="numeric">
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify and continue
          </Button>

          <div className="flex items-center justify-between gap-3 text-sm">
            <button type="button" className="text-primary hover:underline" onClick={() => void handleResend()} disabled={loading}>
              Resend code
            </button>
            <button type="button" className="text-muted-foreground hover:text-foreground hover:underline" onClick={() => { setStep("details"); setOtp(""); setError(null); }} disabled={loading}>
              Change number
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

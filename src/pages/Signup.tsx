import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AuthShell, GoogleIcon } from "@/components/auth/AuthShell";
import { friendlyAuthError, passwordStrength } from "@/lib/auth-helpers";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [hostIntent, setHostIntent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const strength = passwordStrength(password);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || fullName.trim().length < 2) return setError("Please enter your full name.");
    if (!acceptTerms) return setError("You must accept the Terms and Privacy Policy to continue.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setLoading(true);
    const [first, ...rest] = fullName.trim().split(/\s+/);
    const last = rest.join(" ");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName.trim(),
          display_name: fullName.trim(),
          first_name: first,
          last_name: last || null,
          host_intent: hostIntent,
        },
      },
    });

    setLoading(false);
    if (error) return setError(friendlyAuthError(error.message));

    if (hostIntent) sessionStorage.setItem("rentauto_host_intent", "1");

    if (data.session) {
      navigate(hostIntent ? "/become-host" : "/", { replace: true });
    } else {
      navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true });
    }
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
    navigate("/", { replace: true });
  };

  return (
    <AuthShell
      title="Create your account"
      description="Join Rentauto to rent cars from verified Canadian hosts."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">Log in</Link>
        </>
      }
    >
      <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={googleLoading || loading}>
        {googleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GoogleIcon className="mr-2" />}
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password" type={showPw ? "text" : "password"} autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1" aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded ${i < strength.score ? (strength.score >= 3 ? "bg-primary" : "bg-amber-500") : "bg-muted"}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{strength.label} · 8+ chars, mix upper/lowercase, numbers</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type={showPw ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
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
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AuthShell, GoogleIcon } from "@/components/auth/AuthShell";
import { friendlyAuthError } from "@/lib/auth-helpers";
import { toast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        setUnverified(true);
      }
      setError(friendlyAuthError(error.message));
      return;
    }
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

  const handleResend = async () => {
    if (!email.trim()) return setError("Enter your email above to resend the confirmation.");
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    setResending(false);
    if (error) return setError(friendlyAuthError(error.message));
    toast({ title: "Confirmation sent", description: "Check your inbox for a new verification code." });
    navigate(`/verify-email?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to book cars or manage your listings."
      footer={
        <>
          New to Rentauto?{" "}
          <Link to="/signup" className="text-primary hover:underline font-medium">Create an account</Link>
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

      <form onSubmit={handleLogin} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="space-y-2">
              <div>{error}</div>
              {unverified && (
                <Button type="button" size="sm" variant="outline" onClick={handleResend} disabled={resending}>
                  {resending && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
                  Resend confirmation email
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
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
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}

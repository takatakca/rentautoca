import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { friendlyAuthError, passwordStrength } from "@/lib/auth-helpers";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const navigate = useNavigate();
  const strength = passwordStrength(password);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasSession(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasSession(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(friendlyAuthError(error.message));
    setSuccess(true);
    setTimeout(() => navigate("/", { replace: true }), 1500);
  };

  if (!hasSession) {
    return (
      <AuthShell
        title="Invalid or expired link"
        description="This password reset link is invalid or has expired."
        footer={<Link to="/forgot-password" className="text-primary hover:underline">Request a new link</Link>}
      >
        <Button asChild className="w-full"><Link to="/forgot-password">Request new link</Link></Button>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell title="Password updated" description="Redirecting you now…">
        <div className="flex justify-center py-2"><CheckCircle className="h-12 w-12 text-primary" /></div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" description="Choose a strong password to protect your account.">
      <form onSubmit={handleUpdate} className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          {password && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded ${i < strength.score ? (strength.score >= 3 ? "bg-primary" : "bg-amber-500") : "bg-muted"}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{strength.label}</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

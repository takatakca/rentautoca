import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { friendlyAuthError } from "@/lib/auth-helpers";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return setError(friendlyAuthError(error.message));
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        description={`We sent a password reset link to ${email}. Click the link to set a new password.`}
        footer={<Link to="/login" className="text-primary hover:underline">Back to login</Link>}
      >
        <div className="flex justify-center py-2"><CheckCircle className="h-12 w-12 text-primary" /></div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter your email and we'll send you a reset link."
      footer={<Link to="/login" className="text-primary hover:underline">Back to login</Link>}
    >
      <form onSubmit={handleReset} className="space-y-4">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}

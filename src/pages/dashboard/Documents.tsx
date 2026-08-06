import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { VerificationUpload } from "@/components/host/VerificationUpload";
import { DashboardPageHeader, StatusBadge } from "@/components/dashboard/DashboardPageHeader";
import { DOC_STATUS } from "@/lib/dashboard-utils";

export default function DashboardDocuments() {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("host_verifications")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setData(data ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DashboardSkeleton />;

  const status = data?.verification_status ?? "not_submitted";
  const meta = DOC_STATUS[status] ?? DOC_STATUS.not_submitted;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Identity & documents"
        description="Verify your identity once to unlock instant booking and faster check-in."
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            Verification status
          </CardTitle>
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "rejected" && data?.reviewer_notes && (
            <Alert variant="destructive">
              <AlertDescription>{data.reviewer_notes}</AlertDescription>
            </Alert>
          )}
          <VerificationUpload data={data} onSaved={load} />
          <p className="text-xs text-muted-foreground">
            Documents are stored in a private, encrypted bucket. Only you and the Rentauto review team can access
            them, and they are never shared with hosts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

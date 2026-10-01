import { useCallback, useEffect, useState } from "react";
import { CarFront, ShieldCheck } from "lucide-react";

import {
  DriverVerificationUpload,
  type DriverVerificationView,
} from "@/components/dashboard/DriverVerificationUpload";
import { DashboardPageHeader, StatusBadge } from "@/components/dashboard/DashboardPageHeader";
import { VerificationUpload } from "@/components/host/VerificationUpload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/ui/skeletons";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { DOC_STATUS } from "@/lib/dashboard-utils";

type HostVerification = Tables<"host_verifications">;

type DriverStatusResponse = {
  verification?: DriverVerificationView | null;
  error?: string;
};

export default function DashboardDocuments() {
  const { user } = useAuth();
  const [hostVerification, setHostVerification] =
    useState<HostVerification | null>(null);
  const [driverVerification, setDriverVerification] =
    useState<DriverVerificationView | null>(null);
  const [driverError, setDriverError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setDriverError(null);

    const [hostResult, driverResult] = await Promise.all([
      supabase
        .from("host_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.functions.invoke("rentauto-driver-verification", {
        body: { action: "status" },
      }),
    ]);

    setHostVerification(hostResult.data ?? null);

    const driverResponse = (driverResult.data ?? {}) as DriverStatusResponse;
    if (driverResult.error || driverResponse.error) {
      setDriverError(
        driverResponse.error ||
          driverResult.error?.message ||
          "Driver verification could not be loaded.",
      );
    } else {
      setDriverVerification(driverResponse.verification ?? null);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <DashboardSkeleton />;

  const hostStatus =
    hostVerification?.verification_status ?? "not_submitted";
  const hostMeta = DOC_STATUS[hostStatus] ?? DOC_STATUS.not_submitted;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Identity & documents"
        description="Driver eligibility and host identity are separate safety checks. Complete only the section that applies to what you want to do."
      />

      <Card className="border-primary/20">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CarFront className="h-4 w-4 text-primary" aria-hidden="true" />
              Driver eligibility
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Required before a renter can create and pay for a vehicle booking.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {driverError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{driverError}</AlertDescription>
            </Alert>
          ) : null}
          <DriverVerificationUpload
            verification={driverVerification}
            onSaved={load}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              Host identity
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Required for users who want to list and operate vehicles as a Rentauto host.
            </p>
          </div>
          <StatusBadge tone={hostMeta.tone}>{hostMeta.label}</StatusBadge>
        </CardHeader>
        <CardContent className="space-y-4">
          {hostStatus === "rejected" && hostVerification?.reviewer_notes ? (
            <Alert variant="destructive">
              <AlertDescription>
                {hostVerification.reviewer_notes}
              </AlertDescription>
            </Alert>
          ) : null}

          <VerificationUpload data={hostVerification} onSaved={load} />

          <p className="text-xs text-muted-foreground">
            Host identity documents are stored privately. They are not used as a
            substitute for driver eligibility and are never exposed publicly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

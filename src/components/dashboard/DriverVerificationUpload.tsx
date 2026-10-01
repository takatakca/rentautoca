import { useRef, useState } from "react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock3,
  FileImage,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export type DriverVerificationView = {
  id: string;
  status: string;
  licenseRegion: string | null;
  licenseCountry: string;
  licenseExpiresOn: string | null;
  hasLicenseFront: boolean;
  hasLicenseBack: boolean;
  hasSelfie: boolean;
  reviewerNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
};

type DocType = "license_front" | "license_back" | "selfie";

type Props = {
  verification: DriverVerificationView | null;
  onSaved: () => Promise<void>;
};

const DOCS: Array<{
  type: DocType;
  label: string;
  help: string;
  icon: typeof FileImage;
}> = [
  {
    type: "license_front",
    label: "Driver licence — front",
    help: "Clear photo with your name, licence number and expiry visible.",
    icon: FileImage,
  },
  {
    type: "license_back",
    label: "Driver licence — back",
    help: "Upload the complete back of the same valid licence.",
    icon: FileImage,
  },
  {
    type: "selfie",
    label: "Live selfie",
    help: "A recent, well-lit photo of your face for identity comparison.",
    icon: Camera,
  },
];

function statusBadge(status: string) {
  if (status === "approved") {
    return (
      <Badge className="bg-success text-success-foreground">
        <BadgeCheck className="mr-1 h-3 w-3" /> Verified driver
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="secondary">
        <Clock3 className="mr-1 h-3 w-3" /> Under review
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" /> Action required
      </Badge>
    );
  }
  if (status === "expired") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" /> Expired
      </Badge>
    );
  }
  return <Badge variant="outline">Not started</Badge>;
}

export function DriverVerificationUpload({ verification, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [licenseRegion, setLicenseRegion] = useState(
    verification?.licenseRegion || "QC",
  );
  const [licenseExpiresOn, setLicenseExpiresOn] = useState(
    verification?.licenseExpiresOn || "",
  );
  const [paths, setPaths] = useState<Partial<Record<DocType, string>>>({});
  const [uploading, setUploading] = useState<DocType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const refs: Record<DocType, React.RefObject<HTMLInputElement>> = {
    license_front: frontRef,
    license_back: backRef,
    selfie: selfieRef,
  };

  const status = verification?.status || "not_started";
  const locked = status === "approved" || status === "pending";

  const existing: Record<DocType, boolean> = {
    license_front: verification?.hasLicenseFront ?? false,
    license_back: verification?.hasLicenseBack ?? false,
    selfie: verification?.hasSelfie ?? false,
  };

  const handleUpload = async (docType: DocType, file: File) => {
    if (!user) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({
        title: "Unsupported file",
        description: "Use JPG, PNG or WebP.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum size is 10 MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(docType);
    const path = `${user.id}/${docType}/current`;
    const { error } = await supabase.storage
      .from("rentauto-driver-documents")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "0",
      });
    setUploading(null);

    if (error) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setPaths((current) => ({ ...current, [docType]: path }));
    toast({ title: "Document uploaded" });
  };

  const submit = async () => {
    if (!user || submitting) return;

    const licenseFrontPath =
      paths.license_front ||
      (verification?.hasLicenseFront
        ? `${user.id}/license_front/current`
        : null);
    const licenseBackPath =
      paths.license_back ||
      (verification?.hasLicenseBack
        ? `${user.id}/license_back/current`
        : null);
    const selfiePath =
      paths.selfie ||
      (verification?.hasSelfie ? `${user.id}/selfie/current` : null);

    if (!licenseFrontPath || !licenseBackPath || !selfiePath) {
      toast({
        title: "Three documents required",
        description: "Upload the front, back and selfie before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!licenseRegion.trim() || !licenseExpiresOn) {
      toast({
        title: "Licence details required",
        description: "Enter the issuing province/state and licence expiry date.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke(
      "rentauto-driver-verification",
      {
        body: {
          action: "submit",
          licenseCountry: "CA",
          licenseRegion,
          licenseExpiresOn,
          licenseFrontPath,
          licenseBackPath,
          selfiePath,
        },
      },
    );
    setSubmitting(false);

    const response = (data ?? {}) as { ok?: boolean; error?: string };
    if (error || response.error || !response.ok) {
      toast({
        title: "Verification not submitted",
        description: response.error || error?.message || "Try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Driver verification submitted",
      description: "Rentauto will review your licence and selfie.",
    });
    await onSaved();
  };

  if (status === "approved") {
    return (
      <div className="space-y-4">
        {statusBadge(status)}
        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
            <div>
              <p className="font-medium">You are cleared to book Rentauto vehicles.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Licence {verification?.licenseRegion || "CA"} · valid until{" "}
                {verification?.licenseExpiresOn || "verified expiry"}.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="space-y-4">
        {statusBadge(status)}
        <div className="rounded-xl border bg-muted/30 p-4">
          <p className="font-medium">Review in progress</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your driver licence and selfie were submitted. Booking payment stays
            locked until the review is approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {statusBadge(status)}

      {status === "expired" ? (
        <Alert variant="destructive">
          <AlertDescription>
            Your previous approval expired with your driver licence. Upload a
            current licence and submit it for review again.
          </AlertDescription>
        </Alert>
      ) : null}

      {status === "rejected" && verification?.reviewerNotes ? (
        <Alert variant="destructive">
          <AlertDescription>
            {verification.reviewerNotes}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="driver-region">Issuing province / state</Label>
          <Input
            id="driver-region"
            value={licenseRegion}
            onChange={(event) => setLicenseRegion(event.target.value.toUpperCase())}
            maxLength={64}
            placeholder="QC"
            disabled={locked}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="driver-expiry">Licence expiry</Label>
          <Input
            id="driver-expiry"
            type="date"
            value={licenseExpiresOn}
            onChange={(event) => setLicenseExpiresOn(event.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            disabled={locked}
          />
        </div>
      </div>

      <div className="space-y-3">
        {DOCS.map(({ type, label, help, icon: Icon }) => {
          const ready = Boolean(paths[type]) || existing[type];
          return (
            <div
              key={type}
              className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
                  {ready ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>
                </div>
              </div>

              <div className="shrink-0">
                <input
                  ref={refs[type]}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleUpload(type, file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={locked || uploading === type}
                  onClick={() => refs[type].current?.click()}
                >
                  {uploading === type ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {ready ? "Replace" : "Upload"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={submitting || locked}
        onClick={() => void submit()}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
        Submit driver verification
      </Button>

      <p className="text-xs leading-5 text-muted-foreground">
        Driver documents are private and are never shown to vehicle hosts. They
        are used only for Rentauto eligibility, fraud prevention and safety review.
      </p>
    </div>
  );
}

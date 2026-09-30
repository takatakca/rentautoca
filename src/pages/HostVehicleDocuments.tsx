import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type VehicleDocuments = {
  carId: string;
  vin: string | null;
  plateNumber: string | null;
  insuranceStatus: string;
  listingStatus: string;
  hasRegistrationDocument: boolean;
  hasInsuranceDocument: boolean;
  registrationDocumentUrl: string | null;
  insuranceDocumentUrl: string | null;
};

type GetResponse = {
  vehicle?: VehicleDocuments;
  error?: string;
};

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
}

export default function HostVehicleDocuments() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState<"registration" | "insurance" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<VehicleDocuments | null>(null);
  const [vin, setVin] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [registrationPath, setRegistrationPath] = useState<string | null>(null);
  const [insurancePath, setInsurancePath] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-vehicle-documents",
      { body: { action: "get", carId: id } },
    );
    const response = (data ?? {}) as GetResponse;

    if (invokeError || response.error || !response.vehicle) {
      setError(response.error ?? "Vehicle documents could not be loaded.");
      setLoading(false);
      return;
    }

    setDocuments(response.vehicle);
    setVin(response.vehicle.vin ?? "");
    setPlateNumber(response.vehicle.plateNumber ?? "");
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (
    event: ChangeEvent<HTMLInputElement>,
    kind: "registration" | "insurance",
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !user || !id) return;

    if (!allowedTypes.has(file.type)) {
      toast({
        title: "Unsupported file",
        description: "Upload a PDF, JPG, PNG, or WebP document.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Vehicle documents must be 10 MB or smaller.",
        variant: "destructive",
      });
      return;
    }

    setUploading(kind);
    setError(null);

    const path = `${user.id}/${id}/${kind}/${Date.now()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("rentauto-vehicle-documents")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    setUploading(null);

    if (uploadError) {
      toast({
        title: "Upload failed",
        description: uploadError.message,
        variant: "destructive",
      });
      return;
    }

    if (kind === "registration") setRegistrationPath(path);
    else setInsurancePath(path);

    toast({
      title: kind === "registration" ? "Registration uploaded" : "Insurance document uploaded",
      description: "Upload the other required document, then submit both for review.",
    });
  };

  const submit = async () => {
    if (!id || !registrationPath || !insurancePath) return;

    setSubmitting(true);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke(
      "rentauto-vehicle-documents",
      {
        body: {
          action: "submit",
          carId: id,
          vin,
          plateNumber,
          registrationPath,
          insurancePath,
        },
      },
    );

    const response = (data ?? {}) as { ok?: boolean; error?: string };
    setSubmitting(false);

    if (invokeError || response.error || !response.ok) {
      setError(response.error ?? "Vehicle documents could not be submitted.");
      return;
    }

    setRegistrationPath(null);
    setInsurancePath(null);
    toast({
      title: "Documents submitted",
      description: "TAKATAK administration can now review the vehicle documents.",
    });
    await load();
  };

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8 pb-24">
      <Link
        to={id ? `/host/cars/${id}/edit` : "/host/cars"}
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to vehicle
      </Link>

      <div className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight">Vehicle documents</h1>
        <p className="mt-2 text-muted-foreground">
          Registration, insurance proof, VIN, and plate remain private. Changing these records on
          an active listing pauses it until the new documents are reviewed.
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              Verification status
            </CardTitle>
            <CardDescription>Document approval is controlled by TAKATAK administration.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Badge
              variant={documents?.insuranceStatus === "verified" ? "default" : "secondary"}
              className="capitalize"
            >
              {documents?.insuranceStatus ?? "not provided"}
            </Badge>
            <Badge variant="outline" className="capitalize">
              Listing {documents?.listingStatus ?? "draft"}
            </Badge>
            {documents?.insuranceStatus === "verified" ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Documents approved
              </span>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle identity</CardTitle>
            <CardDescription>Use the values printed on the official vehicle records.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vin">VIN</Label>
              <Input
                id="vin"
                value={vin}
                onChange={(event) => setVin(event.target.value.toUpperCase())}
                maxLength={17}
                placeholder="17-character VIN"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plate">Plate number</Label>
              <Input
                id="plate"
                value={plateNumber}
                onChange={(event) => setPlateNumber(event.target.value.toUpperCase())}
                maxLength={12}
                placeholder="ABC 123"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Private documents</CardTitle>
            <CardDescription>
              Accepted: PDF, JPG, PNG, WebP. Maximum 10 MB per file. Both documents are required for each submission.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Registration
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {registrationPath
                  ? "New file ready to submit."
                  : documents?.hasRegistrationDocument
                    ? "A registration document is already on file."
                    : "No registration document on file."}
              </p>
              <label>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void upload(event, "registration")}
                />
                <span>
                  <Button asChild type="button" variant="outline" disabled={uploading !== null}>
                    <span>
                      {uploading === "registration" ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Upload className="h-4 w-4" aria-hidden="true" />
                      )}
                      Upload registration
                    </span>
                  </Button>
                </span>
              </label>
              {documents?.registrationDocumentUrl ? (
                <a
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary"
                  href={documents.registrationDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View current document
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : null}
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Proof of insurance
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {insurancePath
                  ? "New file ready to submit."
                  : documents?.hasInsuranceDocument
                    ? "An insurance document is already on file."
                    : "No insurance document on file."}
              </p>
              <label>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void upload(event, "insurance")}
                />
                <span>
                  <Button asChild type="button" variant="outline" disabled={uploading !== null}>
                    <span>
                      {uploading === "insurance" ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Upload className="h-4 w-4" aria-hidden="true" />
                      )}
                      Upload insurance
                    </span>
                  </Button>
                </span>
              </label>
              {documents?.insuranceDocumentUrl ? (
                <a
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary"
                  href={documents.insuranceDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View current document
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Button
          size="lg"
          onClick={() => void submit()}
          disabled={
            submitting ||
            uploading !== null ||
            vin.trim().length !== 17 ||
            plateNumber.trim().length < 2 ||
            !registrationPath ||
            !insurancePath
          }
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Submit documents for review
        </Button>
      </div>
    </div>
  );
}

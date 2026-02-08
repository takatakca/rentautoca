import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationUploadProps {
  data: Record<string, any> | null;
  onSaved: () => Promise<void>;
}

type DocType = "id_front" | "id_back" | "selfie";

const DOC_LABELS: Record<DocType, string> = {
  id_front: "Government ID (Front)",
  id_back: "Government ID (Back)",
  selfie: "Selfie Photo",
};

export function VerificationUpload({ data, onSaved }: VerificationUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState<DocType | null>(null);
  const fileRefs: Record<DocType, React.RefObject<HTMLInputElement>> = {
    id_front: useRef<HTMLInputElement>(null),
    id_back: useRef<HTMLInputElement>(null),
    selfie: useRef<HTMLInputElement>(null),
  };

  const status = data?.verification_status || "not_started";
  const urls: Record<DocType, string | null> = {
    id_front: data?.id_front_url || null,
    id_back: data?.id_back_url || null,
    selfie: data?.selfie_url || null,
  };

  const handleUpload = async (docType: DocType, file: File) => {
    if (!user) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 10MB.", variant: "destructive" });
      return;
    }

    setUploading(docType);
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/${docType}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("ids-private")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    const urlField = `${docType}_url`;

    // Check if verification record already exists
    const { data: existing } = await supabase
      .from("host_verifications")
      .select("id, id_front_url, id_back_url, selfie_url, verification_status")
      .eq("user_id", user.id)
      .maybeSingle();

    const updateObj: Record<string, any> = { [urlField]: filePath };

    // Auto-set to pending when all docs are present
    if (existing) {
      const allUrls = {
        id_front_url: existing.id_front_url,
        id_back_url: existing.id_back_url,
        selfie_url: existing.selfie_url,
        [urlField]: filePath,
      };
      if (
        allUrls.id_front_url &&
        allUrls.id_back_url &&
        allUrls.selfie_url &&
        (existing.verification_status === "not_started" || existing.verification_status === "rejected")
      ) {
        updateObj.verification_status = "pending";
      }
    }

    let error;
    if (existing) {
      ({ error } = await supabase.from("host_verifications").update(updateObj).eq("user_id", user.id));
    } else {
      ({ error } = await supabase.from("host_verifications").insert({ user_id: user.id, ...updateObj }));
    }

    setUploading(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uploaded", description: `${DOC_LABELS[docType]} saved successfully.` });
      await onSaved();
    }
  };

  const renderStatusBadge = () => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle className="h-3 w-3 mr-1" /> Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" /> Under Review
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" /> Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {renderStatusBadge()}

      {status === "rejected" && data?.reviewer_notes && (
        <Alert variant="destructive">
          <AlertDescription>{data.reviewer_notes}</AlertDescription>
        </Alert>
      )}

      {status === "approved" ? (
        <p className="text-sm text-muted-foreground">
          Your identity has been verified. No further action needed.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Upload a government-issued ID (front and back) and a selfie for verification. Files are stored
            securely and only accessible by you and our admin team.
          </p>

          {(Object.keys(DOC_LABELS) as DocType[]).map((docType) => (
            <div
              key={docType}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                {urls[docType] ? (
                  <CheckCircle className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{DOC_LABELS[docType]}</span>
              </div>
              <div>
                <input
                  ref={fileRefs[docType]}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(docType, file);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRefs[docType].current?.click()}
                  disabled={uploading === docType}
                >
                  {uploading === docType ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : urls[docType] ? (
                    "Replace"
                  ) : (
                    "Upload"
                  )}
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

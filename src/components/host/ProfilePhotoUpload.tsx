import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfilePhotoUploadProps {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
}

export function ProfilePhotoUpload({ currentUrl, onUploaded }: ProfilePhotoUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(filePath);

    // Add cache-busting query param
    const freshUrl = `${publicUrl}?t=${Date.now()}`;

    await supabase.from("profiles").update({ avatar_url: freshUrl }).eq("id", user.id);

    setPreviewUrl(freshUrl);
    onUploaded(freshUrl);
    setUploading(false);
    toast({ title: "Photo uploaded", description: "Your profile photo has been updated." });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar className="h-24 w-24 border-2 border-border">
          {previewUrl ? <AvatarImage src={previewUrl} alt="Profile" /> : null}
          <AvatarFallback className="bg-muted text-muted-foreground">
            <Camera className="h-8 w-8" />
          </AvatarFallback>
        </Avatar>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {previewUrl ? "Change Photo" : "Upload Photo"}
      </Button>
    </div>
  );
}

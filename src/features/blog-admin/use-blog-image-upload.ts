import { useState } from "react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { BUCKET_NAME } from "@/lib/constants";

/**
 * Compress-and-upload pipeline for blog images: converts to WebP capped at
 * 0.8 MB / 1600px, uploads to the `blog_images/` folder, and resolves with
 * the public URL ("" on failure — callers treat that as a no-op).
 */
export function useBlogImageUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = async (file: File): Promise<string> => {
    if (!file) return "";
    if (!supabase) {
      toast.error("DB connection missing. Cannot upload images.");
      return "";
    }

    setIsUploading(true);

    const options = {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.8,
    };

    let compressedFile = file;
    try {
      if (file.type.startsWith("image/")) {
        compressedFile = await imageCompression(file, options);
      }
    } catch (error) {
      console.error("Image compression error:", error);
      toast.warning("Compression failed, uploading original.");
    }

    const sanitizedName = compressedFile.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/__+/g, "_");
    const fileName = `${Date.now()}_${sanitizedName}`;
    const filePath = `blog_images/${fileName}`;

    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressedFile);

    setIsUploading(false);

    if (uploadError) {
      toast.error(`Upload failed: ${uploadError.message}`);
      return "";
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);
    return urlData.publicUrl;
  };

  return { isUploading, uploadImage };
}

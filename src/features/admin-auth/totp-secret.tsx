"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * The QR code and the key for manual entry of a TOTP factor being enrolled.
 * Shared by first-time setup and "Add another method" in Security.
 */
export function TotpSecret({
  qrCodeUrl,
  secret,
}: {
  qrCodeUrl: string;
  secret: string;
}) {
  const [showSecret, setShowSecret] = useState(false);

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success("Secret copied to clipboard");
    } catch {
      toast.error("Couldn't copy it. Please copy the key by hand.");
    }
  };

  return (
    <>
      {qrCodeUrl ? (
        // White behind the code on every theme: scanners need contrast.
        <div className="mt-4 inline-flex rounded-surface bg-white p-3 shadow-e1">
          {/* Supabase returns the QR as an SVG data URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCodeUrl}
            alt="QR code for MFA enrollment"
            className="size-40"
          />
        </div>
      ) : (
        <div className="mt-4 flex size-44 items-center justify-center rounded-surface bg-secondary">
          <Loader2
            className="animate-spin text-muted-foreground"
            aria-label="Loading QR code"
          />
        </div>
      )}
      <div className="mt-4">
        <p className="text-sm text-muted-foreground">
          Can&apos;t scan? Enter this key instead.
        </p>
        <div className="mt-2 flex items-center gap-1 rounded-control bg-secondary py-1.5 pl-3 pr-1">
          <code className="min-w-0 flex-1 break-all text-sm tracking-widest text-foreground">
            {showSecret
              ? secret.match(/.{1,4}/g)?.join(" ")
              : "•••• •••• •••• ••••"}
          </code>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setShowSecret((v) => !v)}
            aria-label={showSecret ? "Hide secret key" : "Show secret key"}
          >
            {showSecret ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={copySecret}
            aria-label="Copy secret key"
          >
            <Copy className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

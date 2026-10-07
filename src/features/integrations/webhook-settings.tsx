"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  useGetIntegrationSettingsQuery,
  useUpdateIntegrationSettingsMutation,
} from "@/store/api/adminApi";
import type { IntegrationSettings } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/utils";
import { isDiscordWebhook } from "./discord-webhook";

/**
 * Editor for one webhook on `integration_settings`.
 *
 * Both webhooks — contact submissions and new visitors — are the same table,
 * the same API slice, the same validation and the same security argument, so
 * they are one component parameterised by which pair of columns it edits. It
 * lives here rather than inside Inbox or Analytics because both compose it, and
 * a feature reaching into another feature's internals is exactly what the
 * architecture forbids.
 *
 * The security argument, once: these used to be `NEXT_PUBLIC_*` environment
 * variables, which Next.js compiles into the client bundle — so the URLs were
 * readable by anyone who opened the site's JavaScript, and a Discord webhook
 * URL is complete authorisation to post whatever you like into that channel.
 * They are now columns on a table with no public read policy at all, and the
 * pings are sent by database triggers through `pg_net`.
 */

export interface WebhookSettingsProps {
  /** Which URL column this instance edits. */
  urlField: "contact_webhook_url" | "visit_webhook_url";
  /** Which boolean column pairs with it. */
  enabledField: "notify_on_contact" | "notify_on_visit";
  label: string;
  toggleLabel: string;
  toggleHint: string;
  /** Which migration adds the columns, so a missing one is diagnosable. */
  migration: string;
}

export function WebhookSettings({
  urlField,
  enabledField,
  label,
  toggleLabel,
  toggleHint,
  migration,
}: WebhookSettingsProps) {
  const { data: settings, isLoading } = useGetIntegrationSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] =
    useUpdateIntegrationSettingsMutation();

  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);

  const storedUrl = settings?.[urlField] ?? "";
  const storedEnabled = settings?.[enabledField] ?? false;

  useEffect(() => {
    if (!settings) return;
    setUrl(storedUrl);
    setEnabled(storedEnabled);
  }, [settings, storedUrl, storedEnabled]);

  const trimmed = url.trim();
  const invalid = trimmed !== "" && !isDiscordWebhook(trimmed);
  const dirty = trimmed !== storedUrl || enabled !== storedEnabled;

  const save = async () => {
    if (invalid) return;
    try {
      await updateSettings({
        [urlField]: trimmed === "" ? null : trimmed,
        [enabledField]: enabled,
      } as Partial<IntegrationSettings>).unwrap();
      toast.success("Notification settings saved");
    } catch (error) {
      toast.error("Could not save notification settings", {
        description: getErrorMessage(error),
      });
    }
  };

  if (isLoading) return null;

  const fieldId = `webhook-${urlField}`;
  const toggleId = `toggle-${enabledField}`;

  return (
    <div className="space-y-4 rounded-surface bg-card p-5 shadow-e1">
      <div className="flex items-start gap-3">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-chart-2"
          aria-hidden
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Stored in an admin-only table and sent by the database, so the URL
          never reaches the public site. Requires migration{" "}
          <code>{migration}</code>.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>{label}</Label>
        <Input
          id={fieldId}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
          aria-invalid={invalid}
          // A webhook URL is a credential. Nothing here needs it visible, and
          // this screen gets opened wherever the owner happens to be.
          type="password"
          autoComplete="off"
        />
        {invalid && (
          <p role="alert" className="text-xs text-destructive">
            That is not a Discord webhook URL. Copy it from Channel settings →
            Integrations → Webhooks.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-6">
        <div className="space-y-0.5">
          <Label htmlFor={toggleId} className="cursor-pointer">
            {toggleLabel}
          </Label>
          <p className="text-xs text-muted-foreground">{toggleHint}</p>
        </div>
        <Switch id={toggleId} checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <Button
        type="button"
        size="sm"
        onClick={save}
        disabled={!dirty || invalid || isSaving}
      >
        {isSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
        Save
      </Button>
    </div>
  );
}

"use client";

import { WebhookSettings } from "@/features/integrations/webhook-settings";

/**
 * The Discord ping for new contact messages.
 *
 * A thin instance of the shared editor: both webhooks live on the same table
 * and differ only in which columns they write, so the panel itself is not
 * duplicated. This panel sits in Inbox rather than Settings deliberately —
 * Settings is bound to the `site_identity` row and its per-group save
 * machinery, and this is a different table with a different security posture.
 */
export function NotificationSettings() {
  return (
    <WebhookSettings
      urlField="contact_webhook_url"
      enabledField="notify_on_contact"
      label="Discord webhook URL"
      toggleLabel="Notify on new messages"
      toggleHint="Messages are still saved here when this is off."
      migration="007-contact-inbox.sql"
    />
  );
}

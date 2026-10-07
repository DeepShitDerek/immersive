"use client";

import { ToggleRow, type SettingsForm } from "./settings-controls";

export function ContactPageSection({ form }: { form: SettingsForm }) {
  return (
    <div className="space-y-3">
      <ToggleRow
        form={form}
        name="profile_data.contact_page.show_contact_form"
        label="Contact form"
        description="The message form people fill in."
      />
      <ToggleRow
        form={form}
        name="profile_data.contact_page.show_availability_badge"
        label="Availability badge"
        description="Reads from the availability line in Status panel."
      />
      <ToggleRow
        form={form}
        name="profile_data.contact_page.show_services"
        label="Services"
        description="The CMS sections attached to /contact."
      />
    </div>
  );
}

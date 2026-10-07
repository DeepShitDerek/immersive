"use client";

import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { SettingsForm } from "./settings-controls";

export function FooterSection({ form }: { form: SettingsForm }) {
  return (
    <FormField
      control={form.control}
      name="footer_data.copyright_text"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Copyright line</FormLabel>
          <FormControl>
            <Textarea {...field} rows={2} className="min-h-[60px]" />
          </FormControl>
          <FormDescription>
            Markdown. Appears at the bottom of every public page.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

"use client";

import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldGroup, ToggleRow, type SettingsForm } from "./settings-controls";

const SORT_LABELS = [
  { value: "pushed", label: "Recently pushed" },
  { value: "updated", label: "Recently updated" },
  { value: "created", label: "Newest first" },
] as const;

export function GitHubSection({ form }: { form: SettingsForm }) {
  const show = form.watch("profile_data.github_projects_config.show");

  return (
    <div className="space-y-6">
      <ToggleRow
        form={form}
        name="profile_data.github_projects_config.show"
        label="Show GitHub projects"
        description="Pulls public repositories onto the projects page."
      />

      <FormField
        control={form.control}
        name="profile_data.github_projects_config.username"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Username</FormLabel>
            <FormControl>
              <Input {...field} placeholder="octocat" />
            </FormControl>
            <FormDescription>
              {show
                ? "Required while the section is shown."
                : "Optional while the section is hidden."}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="profile_data.github_projects_config.sort_by"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SORT_LABELS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="profile_data.github_projects_config.projects_per_page"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repositories shown</FormLabel>
              <FormControl>
                <Input type="number" min={1} max={100} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FieldGroup title="Filters" description="What to leave out.">
        <FormField
          control={form.control}
          name="profile_data.github_projects_config.min_stars"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Minimum stars</FormLabel>
              <FormControl>
                <Input type="number" min={0} {...field} className="h-9" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <ToggleRow
            form={form}
            name="profile_data.github_projects_config.exclude_forks"
            label="Hide forks"
          />
          <ToggleRow
            form={form}
            name="profile_data.github_projects_config.exclude_archived"
            label="Hide archived"
          />
          <ToggleRow
            form={form}
            name="profile_data.github_projects_config.exclude_profile_repo"
            label="Hide the profile README repo"
          />
        </div>
      </FieldGroup>
    </div>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, TriangleAlert } from "lucide-react";
import type { NavLink } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { navLinkSchema } from "@/lib/schemas";
import { normalizeHref, resolveNavTarget } from "./nav-target";

/**
 * Only the two fields the owner edits. `display_order` and `is_visible` are
 * managed by the list (reorder controls, visibility switch), so validating the
 * whole `navLinkSchema` here would demand values this form never collects.
 */
const navLinkFormSchema = navLinkSchema.pick({ label: true, href: true });
type NavLinkFormValues = { label: string; href: string };

interface NavLinkFormProps {
  link: Partial<NavLink> | null;
  /** Every link, so the form can catch a path that is already taken. */
  existingLinks: NavLink[];
  onSave: (data: Partial<NavLink>) => void;
  onCancel: () => void;
}

export function NavLinkForm({
  link,
  existingLinks,
  onSave,
  onCancel,
}: NavLinkFormProps) {
  const form = useForm<NavLinkFormValues>({
    resolver: zodResolver(navLinkFormSchema),
    defaultValues: {
      label: link?.label ?? "",
      href: link?.href ?? "",
    },
  });

  const href = form.watch("href");
  const path = normalizeHref(href || "");
  const target = resolveNavTarget(href || "/");

  // `href` has no unique index, so a collision is only caught if we look.
  const collidesWith = existingLinks.find(
    (other) => other.id !== link?.id && normalizeHref(other.href) === path,
  );

  const handleSubmit = (values: NavLinkFormValues) => {
    onSave({ ...link, ...values });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4 pt-2"
      >
        <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Label</FormLabel>
              <FormControl>
                <Input {...field} autoFocus placeholder="About" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="href"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Path</FormLabel>
              <FormControl>
                <Input {...field} placeholder="/about" className="font-mono" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/*
          What the path does, before saving rather than after. The old copy said
          every path "becomes a page built from its CMS sections", which is only
          true for the unreserved ones — the built-in routes already exist, and
          three reserved segments have no page at all.
        */}
        {href?.trim() && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-surface px-3 py-2.5 text-xs",
              target.kind === "dead" || target.kind === "invalid"
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary/50 text-muted-foreground",
            )}
          >
            {target.kind === "dead" || target.kind === "invalid" ? (
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            )}
            <span className="min-w-0 break-words">
              <strong className="font-medium">{target.label}.</strong>{" "}
              {target.detail}
            </span>
          </div>
        )}

        {collidesWith && (
          <div className="flex items-start gap-2 rounded-surface bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 break-words">
              <strong className="font-medium">
                &ldquo;{collidesWith.label}&rdquo; already uses this path.
              </strong>{" "}
              Two entries pointing at the same page will both appear in the
              menu.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save link</Button>
        </div>
      </form>
    </Form>
  );
}

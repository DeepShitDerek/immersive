"use client";

import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Loader2, RotateCcw, Save } from "lucide-react";
import {
  useGetSiteSettingsQuery,
  useUpdateSiteSettingsMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  siteSettingsDefaultValues,
  siteSettingsSchema,
  type SiteSettingsFormValues,
} from "@/lib/schemas";
import { normalizeSiteContent } from "@/lib/site-identity";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import {
  LoadError,
  ManagerWrapper,
  PageHeader,
} from "@/components/admin/shared";
import { SettingsSkeleton } from "./settings-skeleton";
import { SettingsGroupSwitcher, SettingsNav } from "./settings-nav";
import { SettingsPreviewLazy } from "./settings-preview-lazy";
import {
  DEFAULT_GROUP_ID,
  SETTINGS_GROUPS,
  findGroup,
  type PreviewPage,
  type SettingsGroup,
  groupUnderStyle,
} from "./settings-groups";
import {
  buildGroupPayload,
  getAtPath,
  groupIsDirty,
  issuesForGroup,
} from "./settings-payload";
import { BrandSection } from "./brand-section";
import { HeroSection } from "./hero-section";
import { SocialLinksSection } from "./social-links-section";
import { ThemeSection } from "./theme-section";
import { TypographySection } from "./typography-section";
import { SiteStyleSection } from "./site-style-section";
import { StyleGovernsNotice } from "./style-governs-notice";
import { resolveSiteStyle } from "@/lib/site-style";
import { LayoutSection } from "./layout-section";
import { StatusPanelSection } from "./status-panel-section";
import { GitHubSection } from "./github-section";
import { ContactPageSection } from "./contact-page-section";
import { FooterSection } from "./footer-section";
import type { SettingsForm } from "./settings-controls";

/**
 * Site settings, as a navigator with a live preview.
 *
 * Three things about the shape, each replacing something the previous screen
 * got wrong:
 *
 * - **One group at a time.** Ten cards in a two-column grid meant a long scroll
 *   with no sense of place. The registry in `settings-groups.ts` drives the
 *   rail, the search, and what each Save touches.
 *
 * - **Per-group save.** The old screen ran one resolver over one submit, so an
 *   invalid GitHub username blocked fixing a footer typo. Validation is now
 *   scoped with `issuesForGroup`, and the write with `buildGroupPayload` — so
 *   saving one group never persists another group's half-finished edit.
 *
 * - **A live preview.** Theme, typography, status-panel design and the contact
 *   toggles were all chosen from dropdown labels and verified by opening the
 *   public site in another tab.
 */

const SECTION_BY_GROUP: Record<
  string,
  (props: { form: SettingsForm }) => ReactElement
> = {
  brand: BrandSection,
  hero: HeroSection,
  social: SocialLinksSection,
  theme: ThemeSection,
  typography: TypographySection,
  "site-style": SiteStyleSection,
  layout: LayoutSection,
  status: StatusPanelSection,
  github: GitHubSection,
  contact: ContactPageSection,
  footer: FooterSection,
};

export default function SettingsPage() {
  const {
    data: settingsData,
    isLoading,
    error: loadError,
    refetch,
  } = useGetSiteSettingsQuery();
  const [updateSiteSettings, { isLoading: isSaving }] =
    useUpdateSiteSettingsMutation();

  const [activeId, setActiveId] = useState(DEFAULT_GROUP_ID);
  const [search, setSearch] = useState("");
  const [previewPage, setPreviewPage] = useState<PreviewPage>("home");
  const [invalidIds, setInvalidIds] = useState<ReadonlySet<string>>(new Set());
  /** At `xl`, whether the preview takes half the screen. */
  const [splitPreview, setSplitPreview] = useState(true);
  /** Below `xl`, the preview opens in a sheet instead. */
  const [previewSheet, setPreviewSheet] = useState(false);

  const form = useForm<SiteSettingsFormValues>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: siteSettingsDefaultValues,
    mode: "onBlur",
  });

  /**
   * The last state the server confirmed, and the baseline every dirty check and
   * partial write is measured against.
   *
   * This used to be a sixty-line `useEffect` that scrubbed nulls, merged three
   * levels of defaults by hand and padded two arrays to the number of inputs
   * the form drew. `normalizeSiteContent` already answered the same question
   * for the public site; the admin now asks the same function.
   */
  const serverState = useMemo(
    () =>
      settingsData
        ? (normalizeSiteContent(
            settingsData,
          ) as unknown as SiteSettingsFormValues)
        : null,
    [settingsData],
  );

  /**
   * `false` until the row has been loaded into the form.
   *
   * Between the first render and this effect the form still holds
   * `siteSettingsDefaultValues` while `serverState` holds the real row, so
   * every group compares as dirty and the save bar flashes up for a frame on
   * every visit. Nothing is dirty before the form has been filled.
   */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!serverState) return;
    form.reset(serverState);
    setHydrated(true);
  }, [serverState, form]);

  const values = form.watch();
  const group = findGroup(activeId);

  useEffect(() => {
    if (group.preview) setPreviewPage(group.preview);
  }, [group.preview]);

  const dirtyIds = useMemo(() => {
    if (!serverState || !hydrated) return new Set<string>();
    return new Set(
      SETTINGS_GROUPS.filter((candidate) =>
        groupIsDirty(serverState, values, candidate.fields),
      ).map((candidate) => candidate.id),
    );
  }, [serverState, values, hydrated]);

  const isDirty = dirtyIds.has(group.id);
  // The bar is up whenever *any* group is dirty, not only the one on screen —
  // otherwise navigating away from an edited group hides the only control that
  // would save it.
  const anyDirty = dirtyIds.size > 0;
  useUnsavedGuard(anyDirty);

  /**
   * Save one or more groups in a single write.
   *
   * Taking a list rather than always the active group is what makes "Save all"
   * one round trip instead of N: the payload is every named group's fields laid
   * over the server row at once, so the columns are written once and cannot be
   * left half-applied if a later request fails.
   *
   * A group whose fields fail validation is dropped from the write rather than
   * failing the whole thing — the same rule as the single-group case, applied
   * across the set. Skipping it is reported; it is never silently ignored.
   */
  const saveGroups = useCallback(
    async (targets: readonly SettingsGroup[]) => {
      if (!serverState || targets.length === 0) return;

      const current = form.getValues();
      const parsed = siteSettingsSchema.safeParse(current);
      const issues = parsed.success ? [] : parsed.error.issues;

      const blocked = targets.filter(
        (target) => issuesForGroup(issues, target.fields).length > 0,
      );
      const savable = targets.filter((target) => !blocked.includes(target));

      form.clearErrors();
      for (const target of blocked) {
        for (const issue of issuesForGroup(issues, target.fields)) {
          form.setError(issue.path.join(".") as never, {
            type: "validate",
            message: issue.message,
          });
        }
      }

      setInvalidIds((previous) => {
        const next = new Set(previous);
        for (const target of targets) next.delete(target.id);
        for (const target of blocked) next.add(target.id);
        return next;
      });

      const describeBlocked = () =>
        blocked.map((target) => target.label).join(", ");

      if (savable.length === 0) {
        const first = issuesForGroup(issues, blocked[0].fields)[0];
        // Send the reader to the group that is actually wrong, since with
        // "Save all" it may not be the one on screen.
        setActiveId(blocked[0].id);
        toast.error(`${describeBlocked()} needs fixing`, {
          description: first.message,
        });
        return;
      }

      // Take the validated shape when the whole form parses (it strips blank
      // list rows), and the raw values when it does not, since a failure
      // elsewhere must not stop these groups from being written.
      const source = parsed.success
        ? (parsed.data as SiteSettingsFormValues)
        : current;

      const fields = savable.flatMap((target) => [...target.fields]);
      const payload = buildGroupPayload(serverState, source, fields);

      try {
        await updateSiteSettings(payload).unwrap();
        toast.success(
          savable.length === 1
            ? `${savable[0].label} saved`
            : `Saved ${savable.length} groups`,
        );
        if (blocked.length > 0) {
          toast.error(`${describeBlocked()} was not saved`, {
            description: "Fix the highlighted fields and save again.",
          });
        }
      } catch (error) {
        toast.error("Could not save", { description: getErrorMessage(error) });
      }
    },
    [form, serverState, updateSiteSettings],
  );

  const saveGroup = useCallback(() => saveGroups([group]), [saveGroups, group]);

  const dirtyGroups = useMemo(
    () => SETTINGS_GROUPS.filter((candidate) => dirtyIds.has(candidate.id)),
    [dirtyIds],
  );

  /** Put the named groups' fields back to the last saved values. */
  const revertGroups = useCallback(
    (targets: readonly SettingsGroup[]) => {
      if (!serverState) return;
      for (const target of targets) {
        for (const path of target.fields) {
          form.setValue(path as never, getAtPath(serverState, path) as never, {
            shouldDirty: false,
            shouldValidate: false,
          });
        }
      }
      setInvalidIds((previous) => {
        const next = new Set(previous);
        for (const target of targets) next.delete(target.id);
        return next;
      });
      form.clearErrors();
    },
    [form, serverState],
  );

  const revertGroup = useCallback(
    () => revertGroups([group]),
    [revertGroups, group],
  );

  const revertAll = useCallback(
    () => revertGroups(dirtyGroups),
    [revertGroups, dirtyGroups],
  );

  const header = (actions?: ReactElement) => (
    <PageHeader
      title="Settings"
      description="How the public site looks and reads. Each group saves on its own."
      actions={actions}
    />
  );

  // Without this a failed read left the skeleton up for good.
  if (loadError && !settingsData) {
    return (
      <ManagerWrapper>
        {header()}
        <LoadError what="your settings" error={loadError} onRetry={refetch} />
      </ManagerWrapper>
    );
  }
  if (isLoading || !serverState)
    return (
      <ManagerWrapper>
        {header()}
        <SettingsSkeleton />
      </ManagerWrapper>
    );

  const Section = SECTION_BY_GROUP[group.id];
  // In an immersive site style nothing reads Theme and Typography: they
  // stay editable, say so, and lose their site preview.
  const siteStyle = resolveSiteStyle(values.profile_data?.site_style);
  const { preview: groupPreview, governed } = groupUnderStyle(group, siteStyle);
  const split = splitPreview && !!groupPreview;

  const preview = groupPreview ? (
    <SettingsPreviewLazy
      values={values as never}
      page={previewPage}
      onPageChange={setPreviewPage}
      className="h-full"
    />
  ) : null;

  return (
    <ManagerWrapper>
      {header(
        groupPreview ? (
          <>
            {/* At xl the preview splits the screen with the form, so a public
                layout is judged at a real width, not in a 24rem strip. */}
            <Button
              type="button"
              variant="outline"
              aria-pressed={splitPreview}
              onClick={() => setSplitPreview((on) => !on)}
              className="hidden xl:inline-flex"
            >
              <Eye className="mr-2 size-4" aria-hidden />
              {splitPreview ? "Hide preview" : "Preview"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewSheet(true)}
              className="xl:hidden"
            >
              <Eye className="mr-2 size-4" aria-hidden />
              Preview
            </Button>
          </>
        ) : undefined,
      )}

      <Form {...form}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveGroup();
          }}
          className={cn(
            "grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]",
            split && "xl:grid-cols-[15rem_minmax(0,1fr)_minmax(0,1fr)]",
          )}
        >
          <aside className="hidden lg:block">
            <div className="sticky top-20 max-h-[calc(100dvh-7rem)] overflow-y-auto p-0.5">
              <SettingsNav
                activeId={activeId}
                onSelect={setActiveId}
                dirtyIds={dirtyIds}
                invalidIds={invalidIds}
                search={search}
                onSearchChange={setSearch}
              />
            </div>
          </aside>

          <div className="min-w-0">
            <div className={cn("w-full", !split && "max-w-2xl")}>
              <SettingsGroupSwitcher
                activeId={activeId}
                onSelect={setActiveId}
                dirtyIds={dirtyIds}
                invalidIds={invalidIds}
                className="mb-5 lg:hidden"
              />

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {group.label}
                  </h2>
                  <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                    {group.description}
                  </p>
                </div>
                {/* With one dirty group the save bar's Discard is this. */}
                {isDirty && dirtyIds.size > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={revertGroup}
                    disabled={isSaving}
                  >
                    <RotateCcw className="mr-1.5 size-4" aria-hidden />
                    Revert {group.label.toLowerCase()}
                  </Button>
                )}
              </div>

              <div className="mt-6">
                {governed && (
                  <StyleGovernsNotice style={siteStyle} setting={group.label} />
                )}
                {Section && <Section form={form} />}
              </div>

              {/*
                The save bar belongs to the form, not the window
. Sticky to the bottom of this
                column, it rides along while the form is longer than the
                screen and comes to rest after the last field, so it can
                never cover it; and it sits on the sticky layer, under
                dialogs, not on theirs.

                Any group, not the one on screen: navigating away from an
                edit must not hide the only control that would save it.
              */}
              {anyDirty && (
                <div className="sticky bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.75rem)] z-sticky mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-surface border bg-card px-4 py-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 lg:bottom-4">
                  <p
                    className="w-full text-sm text-muted-foreground sm:w-auto sm:min-w-0 sm:flex-1"
                    aria-live="polite"
                  >
                    <span
                      aria-hidden
                      className="mr-2 inline-block size-1.5 rounded-full bg-warning align-middle"
                    />
                    Unsaved changes in{" "}
                    <span className="font-medium text-foreground">
                      {dirtyGroups.map((entry) => entry.label).join(", ")}
                    </span>
                  </p>

                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={revertAll}
                      disabled={isSaving}
                    >
                      {dirtyIds.size > 1 ? "Discard all" : "Discard"}
                    </Button>

                    {/*
                      Two save buttons only when they mean different things.
                      With a single dirty group "Save all" and "Save this" are
                      the same write.
                    */}
                    {isDirty && dirtyIds.size > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void saveGroup()}
                        disabled={isSaving}
                      >
                        Save {group.label.toLowerCase()}
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveGroups(dirtyGroups)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2
                          className="mr-1.5 size-4 animate-spin"
                          aria-hidden
                        />
                      ) : (
                        <Save className="mr-1.5 size-4" aria-hidden />
                      )}
                      {dirtyIds.size > 1
                        ? `Save all (${dirtyIds.size})`
                        : `Save ${dirtyGroups[0]?.label.toLowerCase() ?? "changes"}`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {split && (
            <aside className="hidden xl:block">
              <div className="sticky top-20 flex h-[calc(100dvh-7rem)] flex-col">
                {preview}
              </div>
            </aside>
          )}
        </form>
      </Form>

      {preview && (
        <Sheet open={previewSheet} onOpenChange={setPreviewSheet}>
          <SheetContent
            side="right"
            className="flex w-full flex-col sm:max-w-2xl"
          >
            <SheetHeader>
              <SheetTitle>Preview</SheetTitle>
            </SheetHeader>
            <div className="mt-4 min-h-0 flex-1">{preview}</div>
          </SheetContent>
        </Sheet>
      )}
    </ManagerWrapper>
  );
}

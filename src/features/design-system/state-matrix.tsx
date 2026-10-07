"use client";

import { useState } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, LoadError, LoadingState } from "@/components/admin/shared";

/**
 * The component state matrix: every core primitive in every state it
 * has, and the token scales, on one page. Lives in the dev harness only
 * (/dev/ui), and `check:a11y` scans it in light, dark and high-contrast
 * themes, so a state that fails contrast or loses its name fails CI rather
 * than waiting to be noticed in one module.
 *
 * Hover and focus cannot be frozen on a static page; Tab through it to see
 * focus rings, which the keyboard walk in `check:a11y` also checks.
 */

const BUTTON_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;
const BADGE_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "destructive",
] as const;

const Z_LAYERS: [name: string, value: number, use: string][] = [
  ["raised", 10, "Above its siblings: badges, hover actions"],
  ["sticky", 20, "Sticky inside a scroll area: table columns, toolbars"],
  ["chrome", 30, "Page chrome: top bar, reading progress, floating buttons"],
  ["rail", 40, "Fixed rails and full-screen editors"],
  ["overlay", 50, "Dialogs, sheets, popovers, menus"],
  ["skip", 60, "Skip link, above an open overlay"],
  ["top", 100, "Maintenance screen"],
];
const DURATIONS: [name: string, ms: number, use: string][] = [
  ["fast", 150, "Small feedback: a check, a colour change"],
  ["base", 200, "Most transitions"],
  ["slow", 300, "Things that move across the screen"],
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-4 rounded-surface bg-card p-6 shadow-e1"
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function State({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

export function StateMatrix() {
  const [checked, setChecked] = useState(true);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Component states</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every core primitive in every state, and the token scales. Tab through
          to see focus.
        </p>
      </header>

      <Section id="buttons" title="Buttons">
        <div className="overflow-x-auto" data-scroll-x>
          <table className="text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="pb-3 pr-6 text-left font-medium text-muted-foreground"
                >
                  Variant
                </th>
                {["Default", "Disabled", "Loading", "Small", "Icon"].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="pb-3 pr-6 text-left font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {BUTTON_VARIANTS.map((variant) => (
                <tr key={variant}>
                  <th scope="row" className="py-2 pr-6 text-left font-normal">
                    {variant}
                  </th>
                  <td className="py-2 pr-6">
                    <Button variant={variant}>Save</Button>
                  </td>
                  <td className="py-2 pr-6">
                    <Button variant={variant} disabled>
                      Save
                    </Button>
                  </td>
                  <td className="py-2 pr-6">
                    <Button variant={variant} disabled aria-busy>
                      <Loader2
                        className="mr-2 size-4 animate-spin"
                        aria-hidden
                      />
                      Saving…
                    </Button>
                  </td>
                  <td className="py-2 pr-6">
                    <Button variant={variant} size="sm">
                      Save
                    </Button>
                  </td>
                  <td className="py-2 pr-6">
                    <Button
                      variant={variant}
                      size="icon"
                      aria-label={`Inbox (${variant})`}
                    >
                      <Inbox className="size-4" aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="fields" title="Fields">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <State label="Empty, with placeholder">
            <Label htmlFor="f-empty">Title</Label>
            <Input id="f-empty" placeholder="Untitled" />
          </State>
          <State label="Filled">
            <Label htmlFor="f-filled">Title</Label>
            <Input id="f-filled" defaultValue="Quarterly review" />
          </State>
          <State label="Invalid">
            <Label htmlFor="f-invalid">Email</Label>
            <Input
              id="f-invalid"
              defaultValue="not-an-email"
              aria-invalid
              aria-describedby="f-invalid-msg"
            />
            <p id="f-invalid-msg" className="text-sm text-destructive">
              Enter an email address.
            </p>
          </State>
          <State label="Disabled">
            <Label htmlFor="f-disabled">Slug</Label>
            <Input id="f-disabled" defaultValue="quarterly-review" disabled />
          </State>
          <State label="Read-only">
            <Label htmlFor="f-readonly">Created</Label>
            <Input id="f-readonly" defaultValue="2026-09-25" readOnly />
          </State>
          <State label="Textarea">
            <Label htmlFor="f-text">Notes</Label>
            <Textarea id="f-text" placeholder="Anything worth keeping" />
          </State>
        </div>
      </Section>

      <Section id="choices" title="Choices">
        <div className="flex flex-wrap gap-8">
          <State label="Checkbox">
            <div className="flex items-center gap-2">
              <Checkbox
                id="c-on"
                checked={checked}
                onCheckedChange={(v) => setChecked(v === true)}
              />
              <Label htmlFor="c-on">Interactive</Label>
            </div>
          </State>
          <State label="Unchecked">
            <div className="flex items-center gap-2">
              <Checkbox id="c-off" />
              <Label htmlFor="c-off">Off</Label>
            </div>
          </State>
          <State label="Disabled">
            <div className="flex items-center gap-2">
              <Checkbox id="c-dis" disabled defaultChecked />
              <Label htmlFor="c-dis">Locked on</Label>
            </div>
          </State>
          <State label="Switch">
            <div className="flex items-center gap-2">
              <Switch id="s-on" defaultChecked />
              <Label htmlFor="s-on">On</Label>
            </div>
          </State>
          <State label="Switch, disabled">
            <div className="flex items-center gap-2">
              <Switch id="s-dis" disabled />
              <Label htmlFor="s-dis">Off, locked</Label>
            </div>
          </State>
        </div>
      </Section>

      <Section id="badges" title="Badges">
        <div className="flex flex-wrap gap-2">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </Section>

      <Section id="feedback" title="Feedback">
        <div className="grid gap-4 md:grid-cols-2">
          <Alert>
            <AlertTitle>Saved</AlertTitle>
            <AlertDescription>Your changes are live.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t save</AlertTitle>
            <AlertDescription>
              The connection dropped. Nothing was changed.
            </AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section id="data-states" title="Data states">
        <div className="grid gap-6 md:grid-cols-3">
          <State label="Loading">
            <LoadingState variant="section" label="Loading notes" />
          </State>
          <State label="Skeleton">
            <div className="w-full space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </State>
          <State label="Empty">
            <EmptyState
              icon={Inbox}
              title="No notes yet"
              description="Start one and it appears here."
              size="compact"
            />
          </State>
        </div>
        <State label="Load error">
          <LoadError
            what="your notes"
            error={new Error("The request timed out.")}
            onRetry={() => {}}
          />
        </State>
      </Section>

      <Section id="tokens" title="Tokens">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">Layers (z-index)</h3>
            <table className="text-sm">
              <tbody>
                {Z_LAYERS.map(([name, value, use]) => (
                  <tr key={name}>
                    <th
                      scope="row"
                      className="py-1 pr-4 text-left font-mono text-xs font-normal"
                    >
                      z-{name}
                    </th>
                    <td className="py-1 pr-4 tabular-nums">{value}</td>
                    <td className="py-1 text-muted-foreground">{use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Durations</h3>
            <table className="text-sm">
              <tbody>
                {DURATIONS.map(([name, ms, use]) => (
                  <tr key={name}>
                    <th
                      scope="row"
                      className="py-1 pr-4 text-left font-mono text-xs font-normal"
                    >
                      duration-{name}
                    </th>
                    <td className="py-1 pr-4 tabular-nums">{ms} ms</td>
                    <td className="py-1 text-muted-foreground">{use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Shape and elevation</h3>
            <div className="flex flex-wrap gap-4">
              {/* Whole class names: Tailwind only generates what it can read. */}
              {(
                [
                  ["e1", "shadow-e1"],
                  ["e2", "shadow-e2"],
                  ["e3", "shadow-e3"],
                ] as const
              ).map(([e, shadow]) => (
                <div
                  key={e}
                  className={`flex size-20 items-center justify-center rounded-surface bg-card text-xs ${shadow}`}
                >
                  surface · {e}
                </div>
              ))}
              <div className="flex h-10 items-center rounded-control border px-3 text-xs">
                control
              </div>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Type scale</h3>
            <p className="text-display font-semibold">Display</p>
            <p className="text-title font-semibold">Title</p>
            <p className="text-heading font-semibold">Heading</p>
            <p className="text-lead">Lead paragraph</p>
            <p className="text-micro text-muted-foreground">Micro</p>
          </div>
        </div>
      </Section>
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Bot,
  Eye,
  Info,
  MoreHorizontal,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  useGetVisitorAnalyticsQuery,
  usePruneSiteVisitsMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { WebhookSettings } from "@/features/integrations/webhook-settings";
import {
  EmptyState,
  LoadError,
  LoadingState,
  ManagerWrapper,
  ModuleTabs,
  PageHeader,
  StatCard,
} from "@/components/admin/shared";
import { getErrorMessage } from "@/lib/utils";
import type { VisitorSlice } from "@/types";
import {
  CHANNEL_LABELS,
  DEVICE_LABELS,
  RANGE_OPTIONS,
  countryFlag,
  countryName,
  formatShare,
  visitorCountUnavailable,
  withOther,
} from "./analytics-display";
import { BreakdownList } from "./breakdown-list";
import { TrafficChart } from "./traffic-chart";

/**
 * Who came to the site, and from where.
 *
 * The data behind this was collected for a long time and readable by
 * nothing — the same shape as `contact_submissions` before the inbox existed.
 *
 * Everything is aggregated by `get_visitor_analytics`; this page never sees an
 * individual visit row, which is deliberate. There is no per-visitor view to
 * build because there is no per-visitor identity to build it from: the hash
 * rotates daily and reverses to nothing.
 */
const RETENTION_DAYS = 400;

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [withBots, setWithBots] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  /** Below `lg`, which breakdown the single tabbed card shows. */
  const [breakdown, setBreakdown] = useState("pages");

  const { data, isLoading, isFetching, error, refetch } =
    useGetVisitorAnalyticsQuery({
      days,
      withBots,
    });
  const [prune, { isLoading: isPruning }] = usePruneSiteVisitsMutation();
  const confirm = useConfirm();

  const noVisitorCount = data ? visitorCountUnavailable(data) : false;

  const devices = useMemo(
    () =>
      (data?.by_device ?? []).map((slice) => ({
        ...slice,
        name: DEVICE_LABELS[slice.name] ?? slice.name,
      })),
    [data?.by_device],
  );

  const channels = useMemo(
    () =>
      (data?.by_channel ?? []).map((slice) => ({
        ...slice,
        name: CHANNEL_LABELS[slice.name] ?? slice.name,
      })),
    [data?.by_channel],
  );

  const runPrune = async () => {
    const ok = await confirm({
      title: `Delete visits older than ${RETENTION_DAYS} days?`,
      description:
        "The rows are removed permanently. Totals for those months go with them — nothing here is recoverable afterwards.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      const removed = await prune(RETENTION_DAYS).unwrap();
      toast.success(
        removed === 0
          ? "Nothing old enough to remove"
          : `Removed ${removed.toLocaleString()} old visits`,
      );
    } catch (cause) {
      toast.error("Could not prune", { description: getErrorMessage(cause) });
    }
  };

  const header = (
    <PageHeader
      title="Analytics"
      description="Visitors to your public site. No IP address is ever stored."
      actions={
        <>
          {/*
            The range, on the right of the header,
            in the shared toggle group rather than a fifth hand-made
            segmented style.
          */}
          <div className="flex w-full items-center gap-1 sm:w-auto">
            <ToggleGroup
              type="single"
              value={String(days)}
              onValueChange={(value) => value && setDays(Number(value))}
              aria-label="Date range"
              className="min-w-0 flex-1 sm:flex-none"
            >
              {RANGE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.days}
                  value={String(option.days)}
                  size="sm"
                  aria-label={option.label}
                  className="flex-1 px-2 sm:flex-none sm:px-2.5"
                >
                  {/* Short on a phone so the range and ⋯ share one row. */}
                  <span aria-hidden className="sm:hidden">
                    {option.short}
                  </span>
                  <span aria-hidden className="hidden sm:inline">
                    {option.label}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {/* Notifications, and the one destructive action, behind ⋯: the
                delete sat beside Notifications as a header button. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label="More analytics actions"
                >
                  <MoreHorizontal className="size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onSelect={() => setNotificationsOpen(true)}>
                  <Bell className="mr-2 size-4" aria-hidden /> Visitor
                  notifications…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={isPruning}
                  onSelect={() => void runPrune()}
                >
                  <Trash2 className="mr-2 size-4" aria-hidden /> Delete visits
                  older than {RETENTION_DAYS} days…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      }
      filters={
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="analytics-bots"
              checked={withBots}
              onCheckedChange={setWithBots}
            />
            <Label htmlFor="analytics-bots" className="font-normal">
              Include bots
            </Label>
          </div>
          {isFetching && !isLoading && (
            <span role="status" className="text-xs text-muted-foreground">
              Updating…
            </span>
          )}
        </div>
      }
    />
  );

  const notifications = (
    <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Visitor notifications</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <WebhookSettings
            urlField="visit_webhook_url"
            enabledField="notify_on_visit"
            label="Discord webhook URL"
            toggleLabel="Ping on new visitors"
            toggleHint="First visit of the day per visitor only — a ping per page view is noise you will mute."
            migration="008-visitor-analytics.sql"
          />
        </div>
      </SheetContent>
    </Sheet>
  );

  if (isLoading) {
    return (
      <ManagerWrapper>
        {header}
        <LoadingState label="Loading analytics" />
        {notifications}
      </ManagerWrapper>
    );
  }

  /**
   * The real error, and a way to retry. Every failure — a dropped
   * connection, an expired session — used to read "not set up yet" and point
   * at a migration file that no longer exists; setup is db/schema.sql.
   */
  if (error || !data) {
    return (
      <ManagerWrapper>
        {header}
        <LoadError
          what="analytics"
          error={error ?? new Error("No data came back.")}
          onRetry={() => void refetch()}
          hint="If this is the first time, the database may not have the analytics functions yet: re-run db/schema.sql in the Supabase SQL editor."
        />
        {notifications}
      </ManagerWrapper>
    );
  }

  const total = data.total_views;

  const breakdowns: {
    id: string;
    title: string;
    slices: VisitorSlice[];
    empty: string;
    renderLabel?: (slice: VisitorSlice) => React.ReactNode;
  }[] = [
    {
      id: "pages",
      title: "Pages",
      slices: data.top_pages,
      empty: "No pages recorded.",
    },
    {
      id: "sources",
      title: "Sources",
      slices: data.top_sources,
      empty: "No sources recorded.",
    },
    {
      id: "channels",
      title: "Channels",
      slices: channels,
      empty: "No channels recorded.",
    },
    {
      id: "countries",
      title: "Countries",
      slices: data.by_country,
      empty:
        "No location data. The lookup is blocked by most ad-blockers; timezone gives the country for everyone else.",
      renderLabel: (slice) => (
        <span className="flex items-center gap-2">
          <span aria-hidden>{countryFlag(slice.name)}</span>
          {countryName(slice.name)}
        </span>
      ),
    },
    {
      id: "cities",
      title: "Cities",
      slices: data.by_city,
      empty:
        "No city data — it comes from the IP lookup, which ad-blockers block.",
    },
    {
      id: "networks",
      title: "Networks",
      slices: data.by_network,
      empty:
        "No network data — it comes from the IP lookup, which ad-blockers block.",
    },
    {
      id: "browsers",
      title: "Browsers",
      slices: withOther(data.by_browser, 6),
      empty: "No browser data.",
    },
    {
      id: "systems",
      title: "Operating systems",
      slices: withOther(data.by_os, 6),
      empty: "No platform data.",
    },
  ];
  const shown = breakdowns.find((b) => b.id === breakdown) ?? breakdowns[0];

  return (
    <ManagerWrapper>
      {header}

      {total === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No visits recorded yet"
          description="Tracking runs on the public site in production only, so nothing is recorded while you develop locally. Give it a real visit and come back."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Page views"
              value={data.total_views.toLocaleString()}
              icon={Eye}
              helpText={`Last ${data.range_days} days`}
            />
            <StatCard
              title="Visitors"
              value={
                noVisitorCount ? "—" : data.total_visitors.toLocaleString()
              }
              icon={Users}
              helpText={
                noVisitorCount
                  ? "Unavailable — see below"
                  : "Unique per day, not per person"
              }
            />
            <StatCard
              title="Views per visitor"
              value={
                noVisitorCount || data.total_visitors === 0
                  ? "—"
                  : (data.total_views / data.total_visitors).toFixed(1)
              }
              icon={TrendingUp}
            />
            <StatCard
              title="Bot traffic"
              value={data.bot_views.toLocaleString()}
              icon={Bot}
              helpText={
                withBots
                  ? "Included in the figures above"
                  : "Excluded from the figures above"
              }
            />
          </div>

          {noVisitorCount && (
            <p className="flex items-start gap-2.5 rounded-surface border border-warning/40 bg-warning/5 p-4 text-sm text-muted-foreground">
              <Info
                className="mt-0.5 size-4 shrink-0 text-warning"
                aria-hidden
              />
              <span>
                Visitor counts are unavailable: the request IP is not reaching
                Postgres, so no <code>visitor_hash</code> could be derived. Page
                views are unaffected. This usually means the{" "}
                <code>x-forwarded-for</code> header is absent — check that
                db/schema.sql has been run.
              </span>
            </p>
          )}

          <TrafficChart
            data={data}
            days={days}
            showVisitors={!noVisitorCount}
          />

          {/*
            Below lg, one card with a tab per breakdown: eight full lists stacked made the page the longest in the
            workspace on a phone. From lg up, all of them in a grid.
          */}
          <section
            aria-label="Breakdowns"
            className="rounded-surface border bg-card p-5 pt-2 lg:hidden"
          >
            <ModuleTabs
              label="Breakdown"
              className="mb-4"
              tabs={breakdowns.map((b) => ({ id: b.id, label: b.title }))}
              current={shown.id}
              onSelect={setBreakdown}
            />
            <BreakdownList
              bare
              title={shown.title}
              slices={shown.slices}
              total={total}
              empty={shown.empty}
              renderLabel={shown.renderLabel}
            />
          </section>

          <div className="hidden gap-5 lg:grid lg:grid-cols-2 xl:grid-cols-3">
            {breakdowns.map((b) => (
              <BreakdownList
                key={b.id}
                title={b.title}
                slices={b.slices}
                total={total}
                empty={b.empty}
                renderLabel={b.renderLabel}
              />
            ))}
          </div>

          <section
            className="rounded-surface border bg-card p-5"
            aria-label="Devices"
          >
            <h2 className="mb-4 text-sm font-semibold text-foreground">
              Devices
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {devices.map((slice) => (
                <div key={slice.name}>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">
                    {formatShare(slice.value, total)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {slice.name}
                    <span className="ml-2 text-xs tabular-nums">
                      {slice.value.toLocaleString()}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {notifications}
    </ManagerWrapper>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { Button } from "@/components/ui/button";

/** The Edge Function's view of the deploy workflow's latest run. */
interface RunSummary {
  status: string;
  conclusion: string | null;
  createdAt: string;
  url: string;
}

type State =
  | { kind: "checking" }
  | { kind: "unavailable" }
  | { kind: "ready"; latest: RunSummary | null };

const POLL_MS = 20_000;

/** The HTTP status behind a failed `functions.invoke`, when there was one. */
function statusOf(error: unknown): number | null {
  const response = (error as { context?: { status?: number } } | null)?.context;
  return typeof response?.status === "number" ? response.status : null;
}

async function call(method: "GET" | "POST") {
  if (!supabase) return { status: 503, data: null };
  const { data, error } = await supabase.functions.invoke("publish-site", {
    method,
  });
  if (!error) return { status: method === "POST" ? 202 : 200, data };
  const status = statusOf(error);
  let body: unknown = null;
  try {
    body = await (error as { context?: Response }).context?.json();
  } catch {
    // No JSON body: the function is not deployed, or the network failed.
  }
  return { status: status ?? 0, data: body };
}

export function describeRun(run: RunSummary | null, now = Date.now()): string {
  if (!run) return "Not published from here yet.";
  if (run.status !== "completed")
    return "Publishing… the site updates when the build finishes.";
  const minutes = Math.round(
    (now - new Date(run.createdAt).getTime()) / 60_000,
  );
  const when =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? `${minutes} min ago`
        : new Date(run.createdAt).toLocaleString();
  return run.conclusion === "success"
    ? `Last published ${when}.`
    : `The last publish failed (${when}).`;
}

/**
 * "Publish site": rebuild the static site, so a new post gets its
 * own page and link preview now rather than at the next push. Goes through
 * the publish-site Edge Function, which holds the GitHub token; until that
 * function is deployed and configured this says so instead of pretending.
 */
export function PublishSiteButton() {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const { status, data } = await call("GET");
    if (status !== 200) {
      setState({ kind: "unavailable" });
      return;
    }
    const latest = (data as { latest: RunSummary | null }).latest;
    setState({ kind: "ready", latest });
    if (latest && latest.status !== "completed") {
      timer.current = setTimeout(() => void refresh(), POLL_MS);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  const publish = async () => {
    setStarting(true);
    const { status, data } = await call("POST");
    setStarting(false);
    if (status === 202) {
      toast.success("Publishing", {
        description: "The site rebuilds and updates in a few minutes.",
      });
    } else if (status === 409) {
      toast.info("A publish is already running");
    } else {
      toast.error("Couldn't start publishing", {
        description:
          (data as { error?: string } | null)?.error ??
          "The publish function did not answer.",
      });
    }
    if (timer.current) clearTimeout(timer.current);
    // GitHub lists the new run a moment after accepting the dispatch.
    timer.current = setTimeout(() => void refresh(), 3000);
  };

  if (state.kind === "checking") return null;

  if (state.kind === "unavailable") {
    return (
      <p className="text-xs text-muted-foreground">
        Changes go live with the next deploy. A Publish button appears here once
        the publish-site function is set up (see the README).
      </p>
    );
  }

  const running =
    state.latest?.status !== undefined && state.latest.status !== "completed";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        onClick={() => void publish()}
        disabled={starting || running}
      >
        {starting || running ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Rocket className="mr-2 size-4" aria-hidden />
        )}
        Publish site
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {describeRun(state.latest)}{" "}
        {state.latest && (
          <a
            href={state.latest.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Build log
          </a>
        )}
      </span>
    </div>
  );
}

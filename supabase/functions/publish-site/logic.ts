/**
 * "Publish site": rebuild and redeploy the static site.
 *
 * The site is a static export. A new post is readable at once through the
 * client-rendered route, but its own page and link-preview card only exist
 * after the next build. This triggers that build: the deploy workflow's
 * `workflow_dispatch`, from a Supabase Edge Function, because it needs a
 * GitHub token and a token in the browser is a token anyone can read.
 *
 * Plain TypeScript with its dependencies passed in, so it is unit-tested
 * (logic.test.ts) apart from Deno and the network (index.ts wires them).
 */

interface RunSummary {
  status: string;
  conclusion: string | null;
  createdAt: string;
  url: string;
}

export interface PublishDeps {
  /** The site's owner with 2FA (`public.is_admin()`), from the caller's JWT. */
  isOwner(): Promise<boolean>;
  /** Deploy runs queued or in progress. */
  activeRuns(): Promise<number>;
  /** Start the deploy workflow. */
  dispatch(): Promise<void>;
  latestRun(): Promise<RunSummary | null>;
}

export interface PublishResponse {
  status: number;
  body: Record<string, unknown>;
}

export async function handlePublish(
  method: string,
  deps: PublishDeps,
): Promise<PublishResponse> {
  if (method !== "GET" && method !== "POST") {
    return {
      status: 405,
      body: { error: "Use GET for status, POST to publish" },
    };
  }
  // Every request, status included: the run list names the repository.
  if (!(await deps.isOwner())) {
    return {
      status: 403,
      body: {
        error: "Only the site owner, signed in with two-factor, can publish",
      },
    };
  }

  if (method === "GET") {
    return { status: 200, body: { latest: await deps.latestRun() } };
  }

  // One build at a time: a second would only queue behind the first (the
  // workflow's concurrency group) and deploy the same commit again.
  if ((await deps.activeRuns()) > 0) {
    return {
      status: 409,
      body: {
        error: "A publish is already running",
        latest: await deps.latestRun(),
      },
    };
  }
  await deps.dispatch();
  return { status: 202, body: { started: true } };
}

/** Browser access for the admin's own origin only, when it is configured. */
export function corsHeaders(
  allowedOrigin: string | undefined,
  requestOrigin: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
  if (requestOrigin && (!allowedOrigin || requestOrigin === allowedOrigin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin;
  }
  return headers;
}

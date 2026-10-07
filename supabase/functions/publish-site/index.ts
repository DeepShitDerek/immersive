// Supabase Edge Function (Deno). Deploy: see DEPLOYMENT.md → "Publish site".
// The logic lives in logic.ts; this file only wires Deno, Supabase and GitHub.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, handlePublish, summariseRun } from "./logic.ts";

const GITHUB_API = "https://api.github.com";

Deno.serve(async (req) => {
  const cors = corsHeaders(
    Deno.env.get("SITE_ORIGIN"),
    req.headers.get("Origin"),
  );
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  const repo = Deno.env.get("GITHUB_REPO"); // "owner/name"
  const token = Deno.env.get("GITHUB_TOKEN"); // fine-grained: Actions read & write on that repo only
  const workflow = Deno.env.get("GITHUB_WORKFLOW") ?? "next-deploy.yml";
  const ref = Deno.env.get("GITHUB_REF") ?? "main";
  if (!repo || !token)
    return json(503, { error: "Publishing is not set up yet" });

  // The caller's own JWT, so the owner check is the database's, under RLS.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    },
  );
  const github = (path: string, init: RequestInit = {}) =>
    fetch(`${GITHUB_API}/repos/${repo}/actions/workflows/${workflow}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "portfolio-publish-site",
      },
    });
  const runs = async () => {
    const response = await github("/runs?per_page=5");
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
    return ((await response.json()).workflow_runs ?? []) as {
      status: string;
      conclusion: string | null;
      created_at: string;
      html_url: string;
    }[];
  };

  try {
    const { status, body } = await handlePublish(req.method, {
      isOwner: async () => (await supabase.rpc("is_admin")).data === true,
      activeRuns: async () =>
        (await runs()).filter((run) => run.status !== "completed").length,
      latestRun: async () => {
        const [latest] = await runs();
        return latest ? summariseRun(latest) : null;
      },
      dispatch: async () => {
        const response = await github("/dispatches", {
          method: "POST",
          body: JSON.stringify({ ref }),
        });
        if (response.status !== 204)
          throw new Error(`GitHub refused the dispatch (${response.status})`);
      },
    });
    return json(status, body);
  } catch (error) {
    return json(502, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

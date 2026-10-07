import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { rest } from "@/lib/rest";
import { MOCK_HIGHLIGHTS } from "@/lib/fallback-data";
import { pickRandom } from "@/lib/random-pick";
import { contactTopicLabel } from "@/lib/contact-topics";
import type { ContactFormValues } from "@/lib/schemas";
import {
  fetchCaseStudyBySlug,
  fetchNavLinks,
  fetchPostBySlug,
  fetchPublishedLifeUpdates,
  fetchPublishedPosts,
  fetchSectionsByPath,
  fetchSiteIdentity,
  type NavLink,
} from "@/lib/public-data";
import type {
  BlogPost,
  CaseStudy,
  GitHubRepo,
  LifeUpdate,
  PortfolioSection,
  PublicHighlight,
  SiteContent,
} from "@/types";

/*
  The public read endpoints delegate to src/lib/public-data.ts, which the
  public pages also call at build time to prerender the same data.
  Change a query there, not here.
*/
export const publicApi = createApi({
  reducerPath: "publicApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    "SiteContent",
    "Posts",
    "Post",
    "Portfolio",
    "Navigation",
    "SiteSettings",
    "LifeUpdates",
    "CaseStudy",
  ],
  endpoints: (builder) => ({
    getSiteIdentity: builder.query<SiteContent, void>({
      queryFn: () => fetchSiteIdentity(),
      providesTags: ["SiteContent"],
    }),

    getNavLinks: builder.query<NavLink[], void>({
      queryFn: () => fetchNavLinks(),
      providesTags: ["Navigation", "SiteContent"],
    }),

    getPublishedBlogPosts: builder.query<BlogPost[], void>({
      queryFn: () => fetchPublishedPosts(),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Posts" as const, id })),
              { type: "Posts", id: "LIST" },
            ]
          : [{ type: "Posts", id: "LIST" }],
    }),

    getBlogPostBySlug: builder.query<BlogPost, string>({
      queryFn: (slug) => fetchPostBySlug(slug),
      // Tagged by slug as well as id: a prerendered post is seeded into the
      // cache by slug, and revalidation has to be able to find it.
      providesTags: (result, error, slug) =>
        result
          ? [
              { type: "Post", id: result.id },
              { type: "Post", id: `slug:${slug}` },
            ]
          : [{ type: "Post", id: `slug:${slug}` }],
    }),

    getCaseStudyBySlug: builder.query<CaseStudy, string>({
      queryFn: (slug) => fetchCaseStudyBySlug(slug),
      providesTags: (result, error, slug) => [
        { type: "CaseStudy", id: `slug:${slug}` },
      ],
    }),

    incrementPostView: builder.mutation<null, string>({
      queryFn: async (postId) => {
        // --- MOCK FALLBACK ---
        if (!rest) return { data: null };
        // ---------------------

        const { error } = await rest.rpc("increment_blog_post_view", {
          post_id_to_increment: postId,
        });
        if (error) return { error };
        return { data: null };
      },
      invalidatesTags: (result, error, postId) => [
        { type: "Post", id: postId },
        { type: "Posts", id: "LIST" },
      ],
    }),

    getPublishedLifeUpdates: builder.query<LifeUpdate[], void>({
      queryFn: () => fetchPublishedLifeUpdates(),
      providesTags: ["LifeUpdates"],
    }),

    getSectionsByPath: builder.query<PortfolioSection[], string>({
      queryFn: (pagePath) => fetchSectionsByPath(pagePath),
      providesTags: (result, error, path) => [{ type: "Portfolio", id: path }],
    }),

    getGitHubRepos: builder.query<
      GitHubRepo[],
      {
        username: string;
        sort_by: string;
        projects_per_page: number;
        page: number;
        exclude_forks: boolean;
        exclude_archived: boolean;
        exclude_profile_repo: boolean;
        min_stars: number;
      }
    >({
      queryFn: async (args) => {
        const {
          username,
          sort_by,
          projects_per_page,
          page,
          exclude_forks,
          exclude_archived,
          exclude_profile_repo,
          min_stars,
        } = args;
        const url = `https://api.github.com/users/${username}/repos?sort=${sort_by}&per_page=${projects_per_page}&type=owner&page=${page}`;
        try {
          const response = await fetch(url);
          if (!response.ok)
            throw new Error(
              `GitHub API request failed: ${response.statusText}`,
            );
          const data: GitHubRepo[] = await response.json();
          const filtered = data.filter((p) => {
            if (exclude_forks && p.fork) return false;
            if (exclude_archived && p.archived) return false;
            if (exclude_profile_repo && p.name === username) return false;
            if (p.stargazers_count < min_stars) return false;
            return !p.private;
          });
          return { data: filtered };
        } catch (error: unknown) {
          return {
            error: {
              message: error instanceof Error ? error.message : "Unknown error",
              details: "",
              hint: "",
              code: "FETCH_ERROR",
            },
          };
        }
      },
    }),

    /**
     * The only public write path in the app.
     *
     * **Dynamic mode** inserts the row and stops. The Discord notification is
     * sent by an AFTER INSERT trigger reading the webhook URL from an
     * admin-only table (`db/schema.sql`). It used to be
     * sent from here, from the browser, using
     * `NEXT_PUBLIC_CONTACT_WEBHOOK_URL` — which is compiled into the client
     * bundle, so anyone could read the URL out of the JS and post arbitrary
     * embeds into the channel. Moving it into the database also ties the ping
     * to a row that exists rather than to a caller's word, and applies it to
     * inserts that never went through this form.
     *
     * **Static mode** has no database to trigger from, so the browser call
     * remains the only way a message can reach anyone. The URL is unavoidably
     * public in a static deployment; that is a property of having no server,
     * not a choice made here.
     *
     * Length bounds and the rate limit behind them are enforced by the
     * database. `contactFormSchema` is the courtesy copy that produces a
     * useful message before the round trip.
     */
    submitContactForm: builder.mutation<null, ContactFormValues>({
      queryFn: async (formData) => {
        if (rest) {
          const { error } = await rest
            .from("contact_submissions")
            .insert(formData);
          if (error) return { error };
          return { data: null };
        }

        const webhookUrl = process.env.NEXT_PUBLIC_CONTACT_WEBHOOK_URL || "";
        if (!webhookUrl) {
          // Nowhere to put it. A success message for a message that went
          // nowhere is worse than an honest failure.
          return {
            error: {
              message:
                "This site has no message delivery configured. Please use one of the direct links instead.",
            },
          };
        }

        try {
          const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: "Portfolio Contact",
              embeds: [
                {
                  title: "New contact form submission",
                  color: 5814783,
                  fields: [
                    {
                      name: "About",
                      value: contactTopicLabel(formData.topic) ?? "Not given",
                      inline: true,
                    },
                    { name: "Name", value: formData.name, inline: true },
                    { name: "Email", value: formData.email, inline: true },
                    { name: "Subject", value: formData.subject },
                    // Discord drops the whole embed rather than truncating a
                    // field over 1024 characters.
                    { name: "Message", value: formData.message.slice(0, 1000) },
                  ],
                  timestamp: new Date().toISOString(),
                  footer: { text: "Contact Form" },
                },
              ],
            }),
          });
          if (!response.ok) {
            return {
              error: { message: "The message could not be delivered." },
            };
          }
        } catch (error) {
          // Keep fetch's own wording ("Failed to fetch"): it is how the form
          // tells a dropped connection from a refusal (contact-errors.ts).
          return {
            error: {
              message:
                error instanceof Error
                  ? error.message
                  : "The message could not be delivered.",
            },
          };
        }

        return { data: null };
      },
    }),

    getLockdownStatus: builder.query<number, void>({
      queryFn: async () => {
        if (!rest) return { data: 0 }; // Mock: Always normal
        const { data, error } = await rest
          .from("security_settings")
          .select("lockdown_level")
          .single();
        if (error || !data) return { data: 0 };
        return { data: data.lockdown_level };
      },
      keepUnusedDataFor: 60,
    }),

    /**
     * One public Library highlight, chosen at random.
     *
     * Reaches a database function rather than either table: visitors have no
     * read policy on the Library, and the function returns only rows the owner
     * marked public, with only the columns a citation needs.
     *
     * Resolves to null on any failure rather than erroring. A quote is
     * decoration, and it must never be the reason a page shows an error —
     * including on a database set up from an older schema, where the function does not
     * exist yet.
     */
    getRandomHighlight: builder.query<PublicHighlight | null, void>({
      queryFn: async () => {
        if (!rest) return { data: pickRandom(MOCK_HIGHLIGHTS) };

        const { data, error } = await rest.rpc("get_random_public_highlight");
        if (error) return { data: null };

        const row = Array.isArray(data) ? data[0] : data;
        return { data: (row as PublicHighlight | undefined) ?? null };
      },
      // Not cached between visits: "a different line each time" is the point.
      keepUnusedDataFor: 0,
    }),
  }),
});

export const {
  useGetSiteIdentityQuery,
  useGetNavLinksQuery,
  useGetPublishedBlogPostsQuery,
  useGetBlogPostBySlugQuery,
  useGetCaseStudyBySlugQuery,
  useIncrementPostViewMutation,
  useSubmitContactFormMutation,
  useGetPublishedLifeUpdatesQuery,
  useGetSectionsByPathQuery,
  useGetGitHubReposQuery,
  useGetLockdownStatusQuery,
  useGetRandomHighlightQuery,
} = publicApi;

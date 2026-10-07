"use client";

import {
  useGetPublishedBlogPostsQuery,
  useGetSectionsByPathQuery,
  useGetSiteIdentityQuery,
} from "@/store/api/publicApi";
import type { BlogPost } from "@/types";
import { isImmersive } from "@/lib/site-style";
import { ImmersiveScroll } from "../motion/scroll-provider";
import { useSiteStyle } from "../styles/use-site-style";
import { featuredItems, homeBeats, statementOf } from "./home-model";
import { Opening } from "./opening";
import { Statement } from "./statement";
import { Proof } from "./proof";
import { SelectedWork } from "./selected-work";
import { Now } from "./now";
import { Writing } from "./writing";
import { Closing } from "./closing";

const NO_POSTS: BlogPost[] = [];

/**
 * The immersive home page: up to seven beats, each drawn from content the
 * site already has. Which beats appear is decided in `homeBeats`.
 */
export default function ImmersiveHome({
  builtSlugs,
}: {
  /** Post slugs prerendered at the last build; see postHref. */
  builtSlugs?: readonly string[];
}) {
  const style = useSiteStyle();
  const { data: identity } = useGetSiteIdentityQuery();
  const { data: sections } = useGetSectionsByPathQuery("/work");
  const { data: posts = NO_POSTS } = useGetPublishedBlogPostsQuery();

  if (!identity) return null;

  const featured = featuredItems(sections);
  const beats = new Set(homeBeats({ identity, featured, posts }));
  const statement = statementOf(identity);

  const page = (
    <>
      <Opening identity={identity} />
      {beats.has("statement") && <Statement {...statement} />}
      {beats.has("proof") && <Proof items={identity.profile_data.proof} />}
      {beats.has("work") && <SelectedWork items={featured} />}
      {beats.has("now") && <Now status={identity.profile_data.status_panel} />}
      {beats.has("writing") && (
        <Writing posts={posts} builtSlugs={builtSlugs} />
      )}
      <Closing identity={identity} />
    </>
  );

  // The harness and the settings preview can render this under any style; a
  // Classic scope gets the document with no motion.
  return isImmersive(style) ? (
    <ImmersiveScroll style={style}>{page}</ImmersiveScroll>
  ) : (
    page
  );
}

import type { Metadata } from "next";
import { socialMetadata } from "@/lib/og/metadata";
import { ogPageImage } from "@/lib/og/pages";
import { siteContent } from "@/lib/site-content";
import { BlogListPage } from "@/features/blog/blog-list-page";
import { StyleSwitch } from "@/features/immersive/style-switch";
import { pagePreload } from "@/lib/public-preload-server";
import { PublicPreload } from "@/store/public-preload";

export const metadata: Metadata = {
  title: siteContent.pages.blog.title,
  description: siteContent.pages.blog.description,
  ...socialMetadata({
    title: siteContent.pages.blog.title,
    description: siteContent.pages.blog.description,
    path: "/blog/",
    image: ogPageImage("blog"),
  }),
};

export default async function Page() {
  const data = await pagePreload({ posts: true });
  // Posts that exist now get prerendered pages (blog/[slug]); the list links
  // to those and sends anything newer to the /blog/view fallback.
  const builtSlugs = (data.posts ?? []).map((post) => post.slug);
  return (
    <PublicPreload data={data}>
      <StyleSwitch
        layout="blog"
        builtSlugs={builtSlugs}
        classic={<BlogListPage builtSlugs={builtSlugs} />}
      />
    </PublicPreload>
  );
}

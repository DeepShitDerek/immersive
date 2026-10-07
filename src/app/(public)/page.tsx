import type { Metadata } from "next";
import { socialMetadata } from "@/lib/og/metadata";
import { ogPageImage } from "@/lib/og/pages";
import { config as appConfig } from "@/lib/config";
import { HomePage } from "@/features/home/home-page";
import { StyleSwitch } from "@/features/immersive/style-switch";
import { pagePreload } from "@/lib/public-preload-server";
import { PublicPreload } from "@/store/public-preload";

export const metadata: Metadata = {
  // site.title already reads "{name} | Portfolio" — bypass the "%s | {author}"
  // root template so the home tab isn't doubled.
  title: { absolute: appConfig.site.title },
  description: appConfig.site.description,
  ...socialMetadata({
    title: appConfig.site.title,
    description: appConfig.site.description,
    path: "/",
    image: ogPageImage("home"),
  }),
};

export default async function Page() {
  const data = await pagePreload({ sections: ["/", "/work"], posts: true });
  const builtSlugs = (data.posts ?? []).map((post) => post.slug);
  return (
    <PublicPreload data={data}>
      <StyleSwitch
        layout="home"
        builtSlugs={builtSlugs}
        classic={<HomePage builtSlugs={builtSlugs} />}
      />
    </PublicPreload>
  );
}

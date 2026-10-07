import type { Metadata } from "next";
import { socialMetadata } from "@/lib/og/metadata";
import { ogPageImage } from "@/lib/og/pages";
import { siteContent } from "@/lib/site-content";
import { AboutPage } from "@/features/about/about-page";
import { pagePreload } from "@/lib/public-preload-server";
import { PublicPreload } from "@/store/public-preload";
import { StyleSwitch } from "@/features/immersive/style-switch";

export const metadata: Metadata = {
  title: siteContent.pages.about.title,
  description: siteContent.pages.about.description,
  ...socialMetadata({
    title: siteContent.pages.about.title,
    description: siteContent.pages.about.description,
    path: "/about/",
    image: ogPageImage("about"),
  }),
};

export default async function Page() {
  const data = await pagePreload({ sections: ["/about"] });
  return (
    <PublicPreload data={data}>
      <StyleSwitch layout="about" classic={<AboutPage />} />
    </PublicPreload>
  );
}

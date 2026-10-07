import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({ identity: undefined as unknown }));

vi.mock("@/store/api/publicApi", () => ({
  useGetSiteIdentityQuery: () => ({ data: state.identity }),
}));
vi.mock("./home/immersive-home", () => ({
  default: ({ builtSlugs }: { builtSlugs?: readonly string[] }) => (
    <p>immersive home {builtSlugs?.join(",")}</p>
  ),
}));
vi.mock("./blog/immersive-blog", () => ({
  default: () => <p>immersive blog</p>,
}));
vi.mock("./blog/immersive-post", () => ({
  default: ({ slug }: { slug: string }) => <p>immersive post {slug}</p>,
}));
vi.mock("./updates/immersive-updates", () => ({
  default: () => <p>immersive updates</p>,
}));
vi.mock("./about/immersive-about", () => ({
  default: () => <p>immersive about</p>,
}));
vi.mock("./contact/immersive-contact", () => ({
  default: () => <p>immersive contact</p>,
}));
vi.mock("./work/immersive-work", () => ({
  default: () => <p>immersive work</p>,
}));
vi.mock("./case-study/immersive-case-study", () => ({
  default: ({ slug }: { slug: string }) => <p>immersive case {slug}</p>,
}));

import { StyleSwitch } from "./style-switch";

const withStyle = (site_style: unknown) => {
  state.identity = { profile_data: { site_style } };
};

afterEach(cleanup);

describe("StyleSwitch", () => {
  it.each([undefined, "classic", "neon", null, 3])(
    "renders the Classic page for a site_style of %j",
    (value) => {
      withStyle(value);
      render(<StyleSwitch layout="home" classic={<p>classic page</p>} />);
      expect(screen.getByText("classic page")).toBeInTheDocument();
      expect(screen.queryByText(/immersive/)).toBeNull();
    },
  );

  it("renders the Classic page before the identity has loaded", () => {
    state.identity = undefined;
    render(<StyleSwitch layout="work" classic={<p>classic page</p>} />);
    expect(screen.getByText("classic page")).toBeInTheDocument();
  });

  it.each(["noir", "paper", "dusk"])(
    "renders the immersive layout for %s",
    async (style) => {
      withStyle(style);
      render(
        <StyleSwitch
          layout="home"
          builtSlugs={["a", "b"]}
          classic={<p>classic page</p>}
        />,
      );
      expect(await screen.findByText("immersive home a,b")).toBeInTheDocument();
      expect(screen.queryByText("classic page")).toBeNull();
    },
  );

  it("picks the layout the route asks for", async () => {
    withStyle("noir");
    const work = render(<StyleSwitch layout="work" classic={null} />);
    expect(await screen.findByText("immersive work")).toBeInTheDocument();
    work.unmount();
    const blog = render(<StyleSwitch layout="blog" classic={null} />);
    expect(await screen.findByText("immersive blog")).toBeInTheDocument();
    blog.unmount();
    const contactPage = render(<StyleSwitch layout="contact" classic={null} />);
    expect(await screen.findByText("immersive contact")).toBeInTheDocument();
    contactPage.unmount();
    const aboutPage = render(<StyleSwitch layout="about" classic={null} />);
    expect(await screen.findByText("immersive about")).toBeInTheDocument();
    aboutPage.unmount();
    const updatesPage = render(<StyleSwitch layout="updates" classic={null} />);
    expect(await screen.findByText("immersive updates")).toBeInTheDocument();
    updatesPage.unmount();
    const post = render(
      <StyleSwitch layout="post" slug="hello" classic={null} />,
    );
    expect(await screen.findByText("immersive post hello")).toBeInTheDocument();
    post.unmount();
    render(<StyleSwitch layout="case-study" slug="ledger" classic={null} />);
    expect(
      await screen.findByText("immersive case ledger"),
    ).toBeInTheDocument();
  });
});

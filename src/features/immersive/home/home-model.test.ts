import { describe, expect, it } from "vitest";
import type { BlogPost, PortfolioItem, PortfolioSection } from "@/types";
import { normalizeSiteContent } from "@/lib/site-identity";
import {
  FEATURED_MAX,
  emailOf,
  featuredItems,
  hasStatus,
  homeBeats,
  statementOf,
  words,
} from "./home-model";

const item = (id: string, display_order = 0): PortfolioItem =>
  ({
    id,
    section_id: "s",
    title: `Project ${id}`,
    display_order,
  }) as PortfolioItem;
const post = (slug: string) => ({ slug, title: slug }) as BlogPost;

/** A site with only a name: the least the owner can have filled in. */
const bare = normalizeSiteContent({
  profile_data: {
    name: "Ada",
    headline: "",
    bio: [],
    proof: [],
    status_panel: { show: false },
  },
  social_links: [],
} as never);

const full = normalizeSiteContent({
  profile_data: {
    name: "Ada",
    title: "Engineer",
    headline: "I build ledgers.",
    bio: ["First paragraph.", "Second."],
    proof: [{ value: "12", label: "Years" }],
    status_panel: { show: true, title: "Now", availability: "Available" },
  },
  social_links: [
    {
      id: "email",
      label: "Email",
      url: "mailto:ada@example.com",
      is_visible: true,
    },
  ],
} as never);

describe("homeBeats", () => {
  it("is only the opening and the closing for a bare site", () => {
    expect(homeBeats({ identity: bare, featured: [], posts: [] })).toEqual([
      "opening",
      "closing",
    ]);
  });

  it("is all seven, in order, for a full site", () => {
    expect(
      homeBeats({ identity: full, featured: [item("a")], posts: [post("p")] }),
    ).toEqual([
      "opening",
      "statement",
      "proof",
      "work",
      "now",
      "writing",
      "closing",
    ]);
  });

  it("skips each beat on its own condition", () => {
    const all = { identity: full, featured: [item("a")], posts: [post("p")] };
    expect(homeBeats({ ...all, featured: [] })).not.toContain("work");
    expect(homeBeats({ ...all, posts: [] })).not.toContain("writing");
    const noProof = normalizeSiteContent({
      ...full,
      profile_data: { ...full.profile_data, proof: [] },
    });
    expect(homeBeats({ ...all, identity: noProof })).not.toContain("proof");
    const statusOff = normalizeSiteContent({
      ...full,
      profile_data: {
        ...full.profile_data,
        status_panel: { ...full.profile_data.status_panel, show: false },
      },
    });
    expect(homeBeats({ ...all, identity: statusOff })).not.toContain("now");
  });

  it("shows the statement for a bio with no headline", () => {
    const bioOnly = normalizeSiteContent({
      ...bare,
      profile_data: { ...bare.profile_data, bio: ["Just a bio."] },
    });
    expect(homeBeats({ identity: bioOnly, featured: [], posts: [] })).toContain(
      "statement",
    );
    expect(statementOf(bioOnly)).toEqual({ headline: "Just a bio.", bio: [] });
  });
});

describe("a never-configured site", () => {
  // The seeded default is a status panel that is on, titled, and empty.
  const fresh = normalizeSiteContent({
    profile_data: { name: "Ada" },
  } as never);

  it("has the status panel on by default, with nothing in it", () => {
    expect(fresh.profile_data.status_panel.show).toBe(true);
    expect(hasStatus(fresh.profile_data.status_panel)).toBe(false);
  });

  it("is the opening and the closing, with no empty Now beat", () => {
    expect(homeBeats({ identity: fresh, featured: [], posts: [] })).toEqual([
      "opening",
      "closing",
    ]);
  });

  it.each([
    ["an availability line", { availability: "Open to work" }],
    [
      "something being explored",
      { currently_exploring: { title: "Exploring", items: ["", "Rust"] } },
    ],
    [
      "a linked latest project",
      {
        latestProject: { name: "Ledger", linkText: "", href: "/work/ledger/" },
      },
    ],
  ])("shows Now once the panel has %s", (_label, patch) => {
    const status = { ...fresh.profile_data.status_panel, ...patch };
    expect(hasStatus(status)).toBe(true);
  });

  it("does not count a latest project whose link is unusable", () => {
    const status = {
      ...fresh.profile_data.status_panel,
      latestProject: {
        name: "Ledger",
        linkText: "",
        href: "javascript:alert(1)",
      },
    };
    expect(hasStatus(status)).toBe(false);
  });
});

describe("statementOf", () => {
  it("uses the headline, with the bio beneath", () => {
    expect(statementOf(full)).toEqual({
      headline: "I build ledgers.",
      bio: ["First paragraph.", "Second."],
    });
  });

  it("is empty for a bare site", () => {
    expect(statementOf(bare)).toEqual({ headline: "", bio: [] });
  });
});

describe("featuredItems", () => {
  const section = (items: PortfolioItem[]) =>
    ({ id: "s", portfolio_items: items }) as PortfolioSection;

  it("is empty for no sections", () => {
    expect(featuredItems(undefined)).toEqual([]);
    expect(featuredItems([])).toEqual([]);
  });

  it("takes items in section order, then display order, up to the maximum", () => {
    const first = section([item("b", 2), item("a", 1)]);
    const second = section(
      Array.from({ length: 9 }, (_, i) => item(`x${i}`, i)),
    );
    const ids = featuredItems([first, second]).map((i) => i.id);
    expect(ids).toHaveLength(FEATURED_MAX);
    expect(ids.slice(0, 3)).toEqual(["a", "b", "x0"]);
  });
});

describe("emailOf", () => {
  it("returns the visible email link", () => {
    expect(emailOf(full)).toBe("mailto:ada@example.com");
  });

  it("is null when the email is hidden or missing", () => {
    expect(emailOf(bare)).toBeNull();
    const hidden = normalizeSiteContent({
      ...full,
      social_links: [{ ...full.social_links[0], is_visible: false }],
    });
    expect(emailOf(hidden)).toBeNull();
  });
});

describe("words", () => {
  it("splits on any whitespace and drops blanks", () => {
    expect(words("  I build\n ledgers. ")).toEqual(["I", "build", "ledgers."]);
    expect(words("")).toEqual([]);
  });
});

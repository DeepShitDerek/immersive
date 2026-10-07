import { describe, expect, it } from "vitest";
import { normalizeSiteContent } from "@/lib/site-identity";
import { aboutParts } from "./about-model";

const identity = (profile: Record<string, unknown>) =>
  normalizeSiteContent({ profile_data: profile } as never);

describe("aboutParts", () => {
  it("gives every part for a full profile", () => {
    const parts = aboutParts(
      identity({
        name: "Ada",
        title: "Engineer | Writer",
        bio: ["Lead **paragraph**.", "", "Second.", "Third."],
        proof: [{ value: "12", label: "Years" }],
        status_panel: { show: true, availability: "Open to work" },
        show_profile_picture: true,
        profile_picture_url: "https://example.com/me.jpg",
      }),
    );
    expect(parts).toEqual({
      name: "Ada",
      role: "Engineer",
      lead: "Lead paragraph.",
      rest: ["Second.", "Third."],
      picture: "https://example.com/me.jpg",
      proof: true,
      now: true,
    });
  });

  it("is only a name for a never-configured site", () => {
    const parts = aboutParts(identity({ name: "Ada" }));
    expect(parts).toMatchObject({
      name: "Ada",
      lead: "",
      rest: [],
      picture: null,
      proof: false,
      // The default status panel is on but says nothing.
      now: false,
    });
  });

  it("has no picture when the toggle is off or the address is unsafe", () => {
    expect(
      aboutParts(
        identity({
          show_profile_picture: false,
          profile_picture_url: "https://example.com/me.jpg",
        }),
      ).picture,
    ).toBeNull();
    expect(
      aboutParts(
        identity({
          show_profile_picture: true,
          profile_picture_url: "javascript:alert(1)",
        }),
      ).picture,
    ).toBeNull();
  });

  it("has an empty role when there is no title", () => {
    expect(aboutParts(identity({ name: "Ada", title: "" })).role).toBe("");
  });
});

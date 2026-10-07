import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { normalizeSiteContent } from "@/lib/site-identity";

const state = vi.hoisted(() => ({ identity: undefined as unknown }));

vi.mock("@/store/api/publicApi", () => ({
  useGetSiteIdentityQuery: () => ({ data: state.identity }),
}));
vi.mock("@/features/contact/contact-form", () => ({
  ContactForm: () => <p>the contact form</p>,
}));
vi.mock("@/features/sections/dynamic-page-content", () => ({
  DynamicPageContent: ({ pagePath }: { pagePath: string }) => (
    <p>cms sections for {pagePath}</p>
  ),
}));

import ImmersiveContact from "./immersive-contact";

const LINKS = [
  {
    id: "email",
    label: "Email",
    url: "mailto:ada@example.com",
    is_visible: true,
  },
  {
    id: "github",
    label: "GitHub",
    url: "https://github.com/ada",
    is_visible: true,
  },
  { id: "x", label: "Hidden", url: "https://x.com/ada", is_visible: false },
  { id: "bad", label: "Bad", url: "javascript:alert(1)", is_visible: true },
];

function site(
  toggles: Record<string, boolean> = {},
  links: unknown[] = LINKS,
  availability = "Open to work",
) {
  const identity = normalizeSiteContent({ social_links: links } as never);
  identity.profile_data.contact_page = {
    show_contact_form: true,
    show_availability_badge: true,
    show_services: true,
    ...toggles,
  };
  identity.profile_data.status_panel.availability = availability;
  state.identity = identity;
}

afterEach(() => {
  cleanup();
  state.identity = undefined;
});

describe("ImmersiveContact", () => {
  it("shows the heading, availability, form, direct lines and services", () => {
    site();
    render(<ImmersiveContact />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Get in touch",
    );
    expect(screen.getByText("Open to work")).toBeInTheDocument();

    const form = screen.getByRole("region", { name: "Contact form" });
    expect(within(form).getByText("Send a message")).toBeInTheDocument();
    expect(within(form).getByText("the contact form")).toBeInTheDocument();

    const lines = screen.getByRole("list", { name: "Direct lines" });
    const links = within(lines).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "mailto:ada@example.com",
      "https://github.com/ada",
    ]);
    expect(lines.textContent).toContain("ada@example.com");
    expect(lines.textContent).toContain("github.com/ada");
    expect(links[1].getAttribute("target")).toBe("_blank");
    expect(links[1].getAttribute("rel")).toBe("noopener noreferrer");
    expect(links[0].getAttribute("target")).toBeNull();

    expect(screen.getByText("cms sections for /contact")).toBeInTheDocument();
  });

  it("drops the form when it is switched off, keeping the direct lines", () => {
    site({ show_contact_form: false });
    render(<ImmersiveContact />);
    expect(screen.queryByText("the contact form")).toBeNull();
    expect(screen.queryByText("Send a message")).toBeNull();
    expect(
      screen.getByRole("list", { name: "Direct lines" }),
    ).toBeInTheDocument();
  });

  it("has no direct-lines heading over an empty list", () => {
    site({}, [LINKS[2], LINKS[3]]);
    render(<ImmersiveContact />);
    expect(screen.queryByText("Direct lines")).toBeNull();
    expect(screen.getByText("the contact form")).toBeInTheDocument();
  });

  it("is still a page with the form off and no links", () => {
    site({ show_contact_form: false }, []);
    const { container } = render(<ImmersiveContact />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("Direct lines")).toBeNull();
    expect(screen.queryByText("Send a message")).toBeNull();
    expect(container.querySelector("[data-part='ways']")).toBeNull();
    expect(screen.getByText("cms sections for /contact")).toBeInTheDocument();
  });

  it("honours the availability and services toggles", () => {
    site({ show_availability_badge: false, show_services: false });
    render(<ImmersiveContact />);
    expect(screen.queryByText("Open to work")).toBeNull();
    expect(screen.queryByText("cms sections for /contact")).toBeNull();
  });

  it("falls back to the Classic availability words", () => {
    site({}, LINKS, "");
    render(<ImmersiveContact />);
    expect(screen.getByText("Available for work")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "./contact-form";
import { classifyContactError } from "./contact-errors";

/**
 * Resolves to `{ error }` for a failed send; `unwrap` throws it, as RTK
 * Query's does. (A vi.fn that returns a rejected promise is reported by
 * Vitest 4 as a test failure even when the caller catches it.)
 */
const submit = vi.fn<(values: unknown) => Promise<{ error?: unknown }>>();

vi.mock("@/store/api/publicApi", () => ({
  useSubmitContactFormMutation: () => [
    (values: unknown) => ({
      unwrap: async () => {
        const outcome = await submit(values);
        if (outcome.error) throw outcome.error;
      },
    }),
    { isLoading: false },
  ],
  useGetSiteIdentityQuery: () => ({
    data: {
      social_links: [
        { id: "email", url: "mailto:me@example.com", is_visible: true },
      ],
    },
  }),
}));

function fillAndSend() {
  fireEvent.click(screen.getByLabelText("A project"));
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Ada Lovelace" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "ada@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Subject"), {
    target: { value: "An analytical engine" },
  });
  fireEvent.change(screen.getByLabelText("Message"), {
    target: { value: "We are building a difference engine and need help." },
  });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));
}

beforeEach(() => submit.mockReset());

describe("ContactForm outcomes", () => {
  it("replaces the form with a lasting confirmation and focuses it", async () => {
    submit.mockResolvedValue({});
    render(<ContactForm />);
    fillAndSend();

    const heading = await screen.findByRole("heading", {
      name: /message sent/i,
    });
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    await waitFor(() => expect(heading).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: /send another/i }));
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });

  it("explains the per-address limit and keeps what was typed", async () => {
    submit.mockResolvedValue({
      error: {
        code: "23514",
        message: "Too many messages from this address. Try again later.",
      },
    });
    render(<ContactForm />);
    fillAndSend();

    const alert = await screen.findByText(/three messages from this address/i);
    expect(alert.closest("[data-contact-error]")).toHaveAttribute(
      "data-contact-error",
      "rate-address",
    );
    expect(
      screen.getByRole("link", { name: /email me directly/i }),
    ).toHaveAttribute("href", "mailto:me@example.com");
    expect(screen.getByLabelText("Message")).toHaveValue(
      "We are building a difference engine and need help.",
    );
  });

  it("says the connection failed when the request never arrived", async () => {
    submit.mockResolvedValue({
      error: { message: "TypeError: Failed to fetch" },
    });
    render(<ContactForm />);
    fillAndSend();
    expect(
      await screen.findByText(/couldn't reach the server/i),
    ).toBeInTheDocument();
  });
});

describe("classifyContactError", () => {
  it.each([
    [
      {
        message: "The contact form is busy. Try again in a moment.",
        code: "23514",
      },
      "rate-site",
    ],
    [
      new TypeError("NetworkError when attempting to fetch resource."),
      "offline",
    ],
    [new TypeError("Load failed"), "offline"],
    [
      {
        code: "23514",
        message: 'violates check constraint "contact_submissions_length_check"',
      },
      "refused",
    ],
    [
      { message: "This site has no message delivery configured." },
      "unconfigured",
    ],
    [{ message: "The message could not be delivered." }, "unknown"],
    [undefined, "unknown"],
  ])("%j → %s", (error, kind) => {
    expect(classifyContactError(error)).toBe(kind);
  });
});

describe("contact topic from the link", () => {
  it("selects the topic a link names, and ignores one it does not know", async () => {
    window.history.replaceState(null, "", "/contact/?topic=project");
    const { unmount } = render(<ContactForm />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText("A project") as HTMLInputElement).checked,
      ).toBe(true),
    );
    unmount();

    window.history.replaceState(null, "", "/contact/?topic=nonsense");
    render(<ContactForm />);
    expect(
      screen
        .getAllByRole("radio")
        .some((radio) => (radio as HTMLInputElement).checked),
    ).toBe(false);
    window.history.replaceState(null, "", "/");
  });
});

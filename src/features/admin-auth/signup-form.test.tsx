import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signUp = vi.fn();
const replace = vi.fn();
vi.mock("@/supabase/client", () => ({ supabase: { auth: { signUp } } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));
vi.mock("@/store/hooks", () => ({ useAppDispatch: () => vi.fn() }));
vi.mock("@/store/api/adminApi", () => ({
  adminApi: { util: { invalidateTags: () => ({ type: "noop" }) } },
  useCheckAdminExistsQuery: () => ({ data: false, isLoading: false }),
}));

const { SignupForm } = await import("./signup-form");

const fill = (password: string) => {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "owner@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
};

beforeEach(() => vi.clearAllMocks());

describe("first-run sign-up", () => {
  it("holds the owner's password to the same rule as Security", () => {
    render(<SignupForm />);
    fill("hunter2!");
    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(
      /at least 12 characters/i,
    );
  });

  it("goes straight to two-factor setup when no confirmation email is needed", async () => {
    signUp.mockResolvedValue({
      data: { session: { access_token: "t" } },
      error: null,
    });
    render(<SignupForm />);
    fill("correct horse battery staple 9");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/admin/setup-mfa"),
    );
  });

  it("asks you to confirm your email when the project requires it", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<SignupForm />);
    fill("correct horse battery staple 9");
    expect(await screen.findByText("Check your email")).toBeTruthy();
    expect(replace).not.toHaveBeenCalledWith("/admin/setup-mfa");
  });
});

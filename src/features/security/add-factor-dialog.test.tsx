import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mfa = {
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
};
vi.mock("@/supabase/client", () => ({ supabase: { auth: { mfa } } }));
const dispatch = vi.fn();
vi.mock("@/store/hooks", () => ({ useAppDispatch: () => dispatch }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// input-otp measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const { AddFactorDialog } = await import("./add-factor-dialog");

beforeEach(() => {
  vi.clearAllMocks();
  mfa.listFactors.mockResolvedValue({
    data: { all: [{ id: "stale", factor_type: "totp", status: "unverified" }] },
  });
  mfa.enroll.mockResolvedValue({
    data: {
      id: "f2",
      totp: { qr_code: "data:image/svg+xml,x", secret: "ABCDEFGH" },
    },
    error: null,
  });
  mfa.unenroll.mockResolvedValue({ error: null });
  mfa.challengeAndVerify.mockResolvedValue({ error: null });
});

function setup(existingNames = ["Phone"]) {
  const onOpenChange = vi.fn();
  render(
    <AddFactorDialog
      open
      onOpenChange={onOpenChange}
      existingNames={existingNames}
    />,
  );
  return { onOpenChange };
}

describe("adding a second 2FA method", () => {
  it("clears abandoned attempts, enrols under the chosen name, and verifies", async () => {
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByAltText("QR code for MFA enrollment");
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "stale" });
    expect(mfa.enroll).toHaveBeenCalledWith({
      factorType: "totp",
      friendlyName: "Backup authenticator",
    });

    const otp = screen.getByLabelText("The 6-digit code it shows");
    fireEvent.change(otp, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Add method" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({
      factorId: "f2",
      code: "123456",
    });
    expect(dispatch).toHaveBeenCalled();
  });

  it("removes the half-enrolled factor when cancelled", async () => {
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByAltText("QR code for MFA enrollment");
    mfa.unenroll.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "f2" });
  });

  it("refuses a name already in use", () => {
    setup(["Backup authenticator"]);
    expect(screen.getByText("A method already has this name.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});

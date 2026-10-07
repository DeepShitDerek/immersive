import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoadError from "./load-error";

describe("LoadError", () => {
  it("says what failed, why, what usually causes it, and retries", () => {
    const onRetry = vi.fn();
    render(
      <LoadError
        what="analytics"
        error={new Error("permission denied")}
        onRetry={onRetry}
        hint="Re-run db/schema.sql."
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't load analytics.");
    expect(alert).toHaveTextContent("permission denied");
    expect(alert).toHaveTextContent("Re-run db/schema.sql.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

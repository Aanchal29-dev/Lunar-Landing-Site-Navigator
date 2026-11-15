import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "./AppErrorBoundary";

function BrokenView(): never { throw new Error("test-only rendering failure"); }

describe("AppErrorBoundary", () => {
  it("shows a safe recovery view instead of a blank page", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<AppErrorBoundary><BrokenView /></AppErrorBoundary>);
    expect(screen.getByRole("heading", { name: "We could not display this view." })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Return to Explore" }).getAttribute("href")).toBe("/explore");
    consoleError.mockRestore();
  });
});

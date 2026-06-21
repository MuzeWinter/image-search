import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ToastContainer } from "../components/shared/Toast";
import { ToastProvider, useToast } from "../contexts/ToastContext";
import type { ReactNode } from "react";

function Wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

function ToastDisplay() {
  const { toasts, addToast } = useToast();
  return (
    <div>
      <button onClick={() => addToast("success", "Saved!")}>Add</button>
      <button onClick={() => addToast("error", "Failed!")}>Add Error</button>
      <ToastContainer />
      <span data-testid="count">{toasts.length}</span>
    </div>
  );
}

describe("ToastContainer", () => {
  it("renders nothing when there are no toasts", () => {
    render(<ToastContainer />, { wrapper: Wrapper });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders toast items with correct type class and message", () => {
    render(<ToastDisplay />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByRole("alert")).toHaveTextContent("Saved!");
    expect(screen.getByRole("alert")).toHaveClass("toast-success");
  });

  it("calls removeToast when clicking a toast", () => {
    render(<ToastDisplay />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("alert"));
    // After mark-as-exiting (sets exiting: true), the item still renders but with exit class
    expect(screen.getByRole("alert")).toHaveClass("toast-exit");
  });

  it("supports multiple toast types", () => {
    render(<ToastDisplay />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText("Add"));
    fireEvent.click(screen.getByText("Add Error"));
    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveClass("toast-success");
    expect(alerts[1]).toHaveClass("toast-error");
    expect(alerts[0]).toHaveTextContent("Saved!");
    expect(alerts[1]).toHaveTextContent("Failed!");
  });

  it("auto-dismisses toast after timeout", async () => {
    vi.useFakeTimers();
    render(<ToastDisplay />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // The addToast sets a 4000ms timer before calling removeToast
    act(() => { vi.advanceTimersByTime(4000); });
    // removeToast marks as exiting and sets a 300ms timer for actual removal
    expect(screen.getByRole("alert")).toHaveClass("toast-exit");

    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByRole("alert")).toBeNull();

    vi.useRealTimers();
  });
});

describe("ToastProvider", () => {
  it("addToast increments toast count", () => {
    render(<ToastDisplay />, { wrapper: Wrapper });
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    fireEvent.click(screen.getByText("Add"));
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("caps history at 5 toasts (only keeps last 5)", () => {
    render(<ToastDisplay />, { wrapper: Wrapper });
    for (let i = 0; i < 7; i++) {
      fireEvent.click(screen.getByText("Add"));
    }
    expect(screen.getAllByRole("alert")).toHaveLength(5);
  });
});

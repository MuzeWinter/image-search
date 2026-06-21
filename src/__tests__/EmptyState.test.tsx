import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState, SearchEmptyIcon, LibraryEmptyIcon } from "../components/shared/EmptyState";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No results" />);
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("renders title and description", () => {
    render(<EmptyState title="No results" description="Try another search" />);
    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText("Try another search")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText("No results")).toBeNull();
    const title = screen.getByText("Empty");
    expect(title).toBeInTheDocument();
    // No description element rendered
    expect(title.parentElement?.querySelector("p")).toBeNull();
  });

  it("renders custom icon when provided", () => {
    render(<EmptyState icon={<span data-testid="custom-icon">X</span>} title="Empty" />);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("does not render icon when not provided", () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector(".empty-state-icon")).toBeNull();
  });

  it("renders action button and fires onClick", () => {
    const onClick = vi.fn();
    render(<EmptyState title="Empty" action={{ label: "Add item", onClick }} />);
    const btn = screen.getByText("Add item");
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not render action button when not provided", () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("SearchEmptyIcon", () => {
  it("renders an SVG with correct attributes", () => {
    const { container } = render(<SearchEmptyIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "64");
    expect(svg).toHaveAttribute("height", "64");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

describe("LibraryEmptyIcon", () => {
  it("renders an SVG with correct attributes", () => {
    const { container } = render(<LibraryEmptyIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "64");
    expect(svg).toHaveAttribute("height", "64");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

interface SkeletonProps {
  variant?: "text" | "card" | "image" | "circle";
  width?: number | string;
  height?: number | string;
  lines?: number;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  if (variant === "text") {
    return (
      <div className="skeleton-text-group" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="skeleton skeleton-text"
            style={{ width: width ?? (i === lines - 1 ? "60%" : "100%") }}
          />
        ))}
      </div>
    );
  }

  if (variant === "circle") {
    return (
      <div
        className="skeleton skeleton-circle"
        style={{ width: width ?? 40, height: height ?? 40 }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`skeleton skeleton-${variant}`}
      style={{
        width: width ?? "100%",
        height: height ?? (variant === "image" ? 200 : 120),
      }}
      aria-hidden="true"
    />
  );
}

import { convertFileSrc } from "@tauri-apps/api/core";
import { useIntersectionObserver } from "../../hooks/useIntersectionObserver";

interface LazyThumbnailProps {
  imagePath: string;
  imgId: string;
  broken: boolean;
  onError: () => void;
  noPreviewText: string;
}

export default function LazyThumbnail({
  imagePath,
  imgId,
  broken,
  onError,
  noPreviewText,
}: LazyThumbnailProps) {
  const url = imagePath?.trim() ? convertFileSrc(imagePath) : null;

  const { ref, isIntersecting } = useIntersectionObserver({
    rootMargin: "300px",
    once: true,
  });

  if (!url || broken) {
    return <div className="img-placeholder">{noPreviewText}</div>;
  }

  if (!isIntersecting) {
    return (
      <div ref={ref} className="lazy-thumb-skeleton" aria-hidden="true" />
    );
  }

  return (
    <img
      ref={ref}
      src={url}
      alt={imgId}
      loading="lazy"
      onError={onError}
    />
  );
}

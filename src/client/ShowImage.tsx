"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { GalleryImage } from "../interface/image";

type ShowImageProps = {
  images: GalleryImage[];
  isLoading: boolean;
  title?: string;
  imageSrc?: (image: GalleryImage) => string;
};

export default function ShowImage({
  images,
  isLoading,
  title = "Your images",
  imageSrc = (image) => `/api/images/${image.id}/file`,
}: ShowImageProps) {
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);

  useEffect(() => {
    if (!selectedImage) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedImage(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedImage]);

  return (
    <section className="mt-10" aria-labelledby="gallery-heading">
      <h2 id="gallery-heading" className="text-xl font-semibold">
        {title}
      </h2>
      {isLoading ? (
        <p className="mt-4 text-slate-600">Loading images...</p>
      ) : images.length === 0 ? (
        <p className="mt-4 text-slate-600">No images uploaded yet.</p>
      ) : (
        <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <li
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              key={image.id}
            >
              <button
                className="group relative block aspect-square w-full cursor-zoom-in bg-slate-100 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                type="button"
                aria-label={`Open ${image.title || "image"} in large view`}
                onDoubleClick={() => setSelectedImage(image)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedImage(image);
                  }
                }}
              >
                <Image
                  className="object-cover"
                  src={imageSrc(image)}
                  alt={image.title || image.place || "Gallery image"}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-4 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {image.place && (
                    <span className="font-semibold">{image.place}</span>
                  )}
                  {image.note && (
                    <span className="line-clamp-3 text-sm">{image.note}</span>
                  )}
                </div>
                <span className="sr-only">
                  Double-click or press Enter to view larger
                </span>
              </button>
              <div className="p-4">
                <h3 className="font-semibold">
                  {image.title || "Untitled image"}
                </h3>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={selectedImage.title || "Image preview"}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedImage(null);
          }}
        >
          <button
            className="absolute right-4 top-4 z-10 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"
            type="button"
            onClick={() => setSelectedImage(null)}
            aria-label="Close image preview"
          >
            Close
          </button>
          <div className="relative h-full max-h-[85vh] w-full max-w-6xl">
            <Image
              className="object-contain"
              src={imageSrc(selectedImage)}
              alt={selectedImage.title || selectedImage.place || "Gallery image"}
              fill
              unoptimized
              sizes="100vw"
            />
          </div>
        </div>
      )}
    </section>
  );
}

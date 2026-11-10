"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ShowImage from "./ShowImage";
import { isAlbum, type Album } from "../interface/album";
import { isGalleryImage, type GalleryImage } from "../interface/image";

type AlbumView = {
  album: Album;
  images: GalleryImage[];
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

function isAlbumView(value: unknown): value is AlbumView {
  return (
    typeof value === "object" &&
    value !== null &&
    "album" in value &&
    isAlbum(value.album) &&
    "images" in value &&
    Array.isArray(value.images) &&
    value.images.every(isGalleryImage)
  );
}

export default function PublicAlbum() {
  const { token } = useParams<{ token: string }>();
  const [albumView, setAlbumView] = useState<AlbumView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/public/albums/${token}`, { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) {
          throw new Error(
            getErrorMessage(payload, "Unable to load this public album."),
          );
        }
        if (!isAlbumView(payload)) {
          throw new Error("The server returned invalid album information.");
        }
        if (active) setAlbumView(payload);
      })
      .catch((loadError: unknown) => {
        console.error("Unable to load public album.", loadError);
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load this public album.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-background p-6 text-foreground sm:p-10">
      <header className="mx-auto max-w-6xl">
        <p className="text-xl font-semibold">Photo Gallery</p>
        {albumView && (
          <p className="mt-2 text-sm text-slate-600">
            Shared by {albumView.album.owner_name}
          </p>
        )}
      </header>
      <section className="mx-auto mt-8 max-w-6xl">
        {error ? (
          <p className="rounded-lg bg-white p-5 text-red-700" role="alert">
            {error}
          </p>
        ) : albumView ? (
          <ShowImage
            images={albumView.images}
            isLoading={isLoading}
            title={albumView.album.name}
            imageSrc={(image) =>
              `/api/images/${image.id}/file?publicToken=${encodeURIComponent(token)}`
            }
          />
        ) : (
          <p className="text-slate-600" role="status">
            {isLoading ? "Loading album..." : "Album unavailable."}
          </p>
        )}
      </section>
    </main>
  );
}

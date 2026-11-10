"use client";

import { useState } from "react";
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

type SharedAlbumsTabProps = {
  albums: Album[];
  isLoading: boolean;
};

export default function SharedAlbumsTab({
  albums,
  isLoading,
}: SharedAlbumsTabProps) {
  const sharedAlbums = albums.filter((album) => !album.can_edit);
  const [viewedAlbum, setViewedAlbum] = useState<AlbumView | null>(null);
  const [isLoadingAlbum, setIsLoadingAlbum] = useState(false);
  const [error, setError] = useState("");

  async function viewAlbum(album: Album) {
    setError("");
    setIsLoadingAlbum(true);
    try {
      const response = await fetch(`/api/albums/${album.id}`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to load album."));
      }
      if (!isAlbumView(payload)) {
        throw new Error("The server returned invalid album information.");
      }
      setViewedAlbum(payload);
    } catch (viewError) {
      console.error("Unable to load shared album.", viewError);
      setError(
        viewError instanceof Error
          ? viewError.message
          : "Unable to load shared album.",
      );
    } finally {
      setIsLoadingAlbum(false);
    }
  }

  return (
    <section className="mt-10" aria-labelledby="shared-albums-heading">
      {isLoading ? (
        <p className="mt-4 text-slate-600">Loading shared albums...</p>
      ) : sharedAlbums.length === 0 ? (
        <p className="mt-4 text-slate-600">
          No albums have been shared with you yet.
        </p>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sharedAlbums.map((album) => (
            <li
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              key={album.id}
            >
              <h3 className="font-semibold">{album.name}</h3>
              <p className="mt-1 text-sm text-slate-600">
                Shared by {album.owner_name}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {album.image_ids.length}{" "}
                {album.image_ids.length === 1 ? "image" : "images"}
              </p>
              <button
                className="mt-3 rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600"
                type="button"
                onClick={() => void viewAlbum(album)}
                disabled={isLoadingAlbum}
              >
                View
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {viewedAlbum && (
        <ShowImage
          images={viewedAlbum.images}
          isLoading={isLoadingAlbum || isLoading}
          title={`${viewedAlbum.album.name} images`}
        />
      )}
    </section>
  );
}

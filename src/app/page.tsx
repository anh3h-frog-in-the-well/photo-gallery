"use client";

import { useEffect, useState } from "react";
import AlbumsTab from "../client/AlbumsTab";
import AuthControl from "../client/AuthControl";
import SharedAlbumsTab from "../client/SharedAlbumsTab";
import ShowImage from "../client/ShowImage";
import UploadImage from "../client/UploadImage";
import { isAlbum, type Album } from "../interface/album";
import { isGalleryImage, type GalleryImage } from "../interface/image";

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<
    "images" | "albums" | "shared-albums"
  >("images");
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [areAlbumsLoading, setAreAlbumsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/images", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "Unable to load images."));
        }
        if (!Array.isArray(payload) || !payload.every(isGalleryImage)) {
          throw new Error("The server returned an invalid image list.");
        }
        if (active) setImages(payload);
      })
      .catch((loadError: unknown) => {
        console.error("Unable to load gallery images.", loadError);
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load images.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/albums", { cache: "no-store" })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "Unable to load albums."));
        }
        if (!Array.isArray(payload) || !payload.every(isAlbum)) {
          throw new Error("The server returned an invalid album list.");
        }
        if (active) setAlbums(payload);
      })
      .catch((loadError: unknown) => {
        console.error("Unable to load albums.", loadError);
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load albums.",
          );
        }
      })
      .finally(() => {
        if (active) setAreAlbumsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background p-6 text-foreground sm:p-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white"
          >
            P
          </span>
          <span className="text-xl font-semibold">Photo Gallery</span>
        </div>
        <AuthControl />
      </header>

      <section className="mx-auto mt-12 max-w-6xl">
        <nav className="flex gap-2 border-b border-slate-200" aria-label="Gallery sections">
          <button
            className={`border-b-2 px-4 py-3 font-semibold ${
              activeTab === "images"
                ? "border-sky-500 text-sky-700"
                : "border-transparent text-slate-600 hover:text-sky-700"
            }`}
            type="button"
            role="tab"
            aria-selected={activeTab === "images"}
            onClick={() => setActiveTab("images")}
          >
            Your images
          </button>
          <button
            className={`border-b-2 px-4 py-3 font-semibold ${
              activeTab === "albums"
                ? "border-sky-500 text-sky-700"
                : "border-transparent text-slate-600 hover:text-sky-700"
            }`}
            type="button"
            role="tab"
            aria-selected={activeTab === "albums"}
            onClick={() => setActiveTab("albums")}
          >
            Your albums
          </button>
          <button
            className={`border-b-2 px-4 py-3 font-semibold ${
              activeTab === "shared-albums"
                ? "border-sky-500 text-sky-700"
                : "border-transparent text-slate-600 hover:text-sky-700"
            }`}
            type="button"
            role="tab"
            aria-selected={activeTab === "shared-albums"}
            onClick={() => setActiveTab("shared-albums")}
          >
            Shared albums
          </button>
        </nav>
        <div role="tabpanel">
          {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
          {activeTab === "images" ? (
            <>
              <ShowImage images={images} isLoading={isLoading} />
              <UploadImage
                onUploaded={(image) => setImages((current) => [image, ...current])}
              />
            </>
          ) : activeTab === "albums" ? (
            <AlbumsTab
              albums={albums.filter((album) => album.can_edit)}
              images={images}
              isLoading={isLoading || areAlbumsLoading}
              onAlbumCreated={(album) =>
                setAlbums((current) => [album, ...current])
              }
              onAlbumUpdated={(updatedAlbum) =>
                setAlbums((current) =>
                  current.map((album) =>
                    album.id === updatedAlbum.id ? updatedAlbum : album,
                  ),
                )
              }
            />
          ) : (
            <SharedAlbumsTab
              albums={albums}
              isLoading={areAlbumsLoading}
            />
          )}
        </div>
      </section>
    </main>
  );
}

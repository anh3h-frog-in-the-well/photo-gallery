"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { isAlbum, type Album } from "../interface/album";
import { isGalleryImage, type GalleryImage } from "../interface/image";
import ShowImage from "./ShowImage";

type ShowAlbumProps = {
  albums: Album[];
  images: GalleryImage[];
  isLoading: boolean;
  onAlbumUpdated: (album: Album) => void;
};

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

export default function ShowAlbum({
  albums,
  images,
  isLoading,
  onAlbumUpdated,
}: ShowAlbumProps) {
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<
    "edit" | "share" | "public" | null
  >(null);
  const [viewedAlbum, setViewedAlbum] = useState<AlbumView | null>(null);
  const [albumName, setAlbumName] = useState("");
  const [editImageIds, setEditImageIds] = useState<string[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [isLoadingAlbum, setIsLoadingAlbum] = useState(false);
  const [isLoadingPublicLink, setIsLoadingPublicLink] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function chooseAlbum(album: Album) {
    setSelectedAlbum(album);
    setOpenMenuId((current) => (current === album.id ? null : album.id));
    setActiveAction(null);
    setError("");
    setStatus("");
  }

  async function viewAlbum(album: Album) {
    setError("");
    setStatus("");
    setOpenMenuId(null);
    setActiveAction(null);
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
      console.error("Unable to load album.", viewError);
      setError(
        viewError instanceof Error ? viewError.message : "Unable to load album.",
      );
    } finally {
      setIsLoadingAlbum(false);
    }
  }

  function openEdit(album: Album) {
    setSelectedAlbum(album);
    setAlbumName(album.name);
    setEditImageIds(album.image_ids);
    setActiveAction("edit");
    setOpenMenuId(null);
    setError("");
    setStatus("");
  }

  async function saveAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAlbum) return;
    setError("");
    setStatus("");
    setIsSaving(true);
    try {
      const response = await fetch(`/api/albums/${selectedAlbum.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: albumName.trim(),
          imageIds: editImageIds,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to update album."));
      }
      if (!isAlbum(payload)) {
        throw new Error("The server returned invalid album information.");
      }
      onAlbumUpdated(payload);
      setSelectedAlbum(payload);
      setViewedAlbum((current) =>
        current?.album.id === payload.id
          ? {
              album: payload,
              images: images.filter((image) =>
                payload.image_ids.includes(image.id),
              ),
            }
          : current,
      );
      setStatus(`Updated "${payload.name}".`);
      setActiveAction(null);
    } catch (saveError) {
      console.error("Unable to update album.", saveError);
      setError(
        saveError instanceof Error ? saveError.message : "Unable to update album.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function shareAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAlbum) return;
    setError("");
    setStatus("");
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/albums/${selectedAlbum.id}/shares`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: shareEmail }),
        },
      );
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to share album."));
      }
      setStatus(`Shared "${selectedAlbum.name}" with ${shareEmail.trim()}.`);
      setShareEmail("");
      setActiveAction(null);
    } catch (shareError) {
      console.error("Unable to share album.", shareError);
      setError(
        shareError instanceof Error ? shareError.message : "Unable to share album.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openShare(album: Album) {
    setSelectedAlbum(album);
    setActiveAction("share");
    setShareEmail("");
    setError("");
    setStatus("");
    setOpenMenuId(null);
  }

  async function openPublicShare(album: Album) {
    setSelectedAlbum(album);
    setActiveAction("public");
    setPublicLink(null);
    setError("");
    setStatus("");
    setOpenMenuId(null);
    setIsLoadingPublicLink(true);
    try {
      const response = await fetch(`/api/albums/${album.id}/public-link`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Unable to load public link settings."),
        );
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("token" in payload) ||
        (typeof payload.token !== "string" && payload.token !== null)
      ) {
        throw new Error("The server returned invalid public link information.");
      }
      if (payload.token) {
        setPublicLink(
          `${window.location.origin}/shared/${encodeURIComponent(payload.token)}`,
        );
      }
    } catch (linkError) {
      console.error("Unable to load public link settings.", linkError);
      setError(
        linkError instanceof Error
          ? linkError.message
          : "Unable to load public link settings.",
      );
    } finally {
      setIsLoadingPublicLink(false);
    }
  }

  async function enablePublicLink() {
    if (!selectedAlbum) return;
    setError("");
    setStatus("");
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/albums/${selectedAlbum.id}/public-link`,
        { method: "POST" },
      );
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Unable to create a public album link."),
        );
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("token" in payload) ||
        typeof payload.token !== "string" ||
        !/^[0-9a-f]{64}$/i.test(payload.token)
      ) {
        throw new Error("The server returned an invalid public album link.");
      }
      setPublicLink(
        `${window.location.origin}/shared/${encodeURIComponent(payload.token)}`,
      );
      setStatus("Public link is enabled. Anyone with the URL can view this album.");
    } catch (linkError) {
      console.error("Unable to enable public album link.", linkError);
      setError(
        linkError instanceof Error
          ? linkError.message
          : "Unable to create a public album link.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function revokePublicLink() {
    if (!selectedAlbum) return;
    setError("");
    setStatus("");
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/albums/${selectedAlbum.id}/public-link`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const payload: unknown = await response.json();
        throw new Error(
          getErrorMessage(payload, "Unable to disable the public link."),
        );
      }
      setPublicLink(null);
      setStatus("Public album link has been disabled.");
    } catch (linkError) {
      console.error("Unable to revoke public album link.", linkError);
      setError(
        linkError instanceof Error
          ? linkError.message
          : "Unable to disable the public link.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function copyPublicLink() {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setStatus("Public album URL copied.");
    } catch (copyError) {
      console.error("Unable to copy public album URL.", copyError);
      setError("Unable to copy the URL. Select and copy it manually.");
    }
  }

  function toggleEditImage(imageId: string) {
    setEditImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId],
    );
  }

  return (
    <section className="mt-8 grid gap-3" aria-labelledby="albums-list-heading">
      <h2 id="albums-list-heading" className="text-lg font-semibold">
        Existing albums
      </h2>
      {albums.length === 0 ? (
        <p className="text-slate-600">You haven&apos;t created an album yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <li key={album.id}>
              <div
                className={`rounded-xl border p-4 ${
                  selectedAlbum?.id === album.id
                    ? "border-sky-500 bg-sky-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    className="min-w-0 flex-1 text-left"
                    type="button"
                    aria-expanded={openMenuId === album.id}
                    onClick={() => chooseAlbum(album)}
                  >
                    <span className="block font-semibold">{album.name}</span>
                    <span className="mt-1 block text-sm text-slate-600">
                      {album.image_ids.length}{" "}
                      {album.image_ids.length === 1 ? "image" : "images"}
                    </span>
                  </button>
                  <button
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
                    type="button"
                    aria-label={`Album actions for ${album.name}`}
                    aria-expanded={openMenuId === album.id}
                    onClick={() => chooseAlbum(album)}
                  >
                    ⋮
                  </button>
                </div>
                {openMenuId === album.id && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                    <button
                      className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600"
                      type="button"
                      onClick={() => void viewAlbum(album)}
                    >
                      View
                    </button>
                    {album.can_edit && (
                      <>
                        <button
                          className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600"
                          type="button"
                          onClick={() => openEdit(album)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600"
                          type="button"
                          onClick={() => openShare(album)}
                        >
                          Share
                        </button>
                        <button
                          className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-600"
                          type="button"
                          onClick={() => void openPublicShare(album)}
                        >
                          Share publicly
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && !activeAction && (
        <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>
      )}
      {status && <p className="mt-3 text-sm text-green-700" role="status">{status}</p>}

      {activeAction === "edit" && selectedAlbum && (
        <form
          className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={saveAlbum}
        >
          <h3 className="text-lg font-semibold">Edit {selectedAlbum.name}</h3>
          <label className="grid gap-2 text-sm font-medium">
            Album name
            <input
              className="rounded-lg border border-slate-300 p-2"
              value={albumName}
              onChange={(event) => setAlbumName(event.target.value)}
              maxLength={255}
              required
              disabled={isSaving}
            />
          </label>
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">Album images</legend>
            {images.map((image) => (
              <label
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-2"
                key={image.id}
              >
                <input
                  type="checkbox"
                  checked={editImageIds.includes(image.id)}
                  onChange={() => toggleEditImage(image.id)}
                  disabled={isSaving}
                />
                <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                  <Image
                    className="object-cover"
                    src={`/api/images/${image.id}/file`}
                    alt=""
                    fill
                    unoptimized
                    sizes="64px"
                  />
                </span>
                <span className="text-sm font-medium">
                  {image.title || "Untitled image"}
                </span>
              </label>
            ))}
          </fieldset>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <div className="flex gap-3">
            <button
              className="rounded-lg bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
            <button
              className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-50"
              type="button"
              onClick={() => setActiveAction(null)}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {activeAction === "share" && selectedAlbum && (
        <form
          className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={shareAlbum}
        >
          <h3 className="text-lg font-semibold">Share {selectedAlbum.name}</h3>
          <p className="text-sm text-slate-600">
            The recipient can view this album and its images.
          </p>
          <label className="grid gap-2 text-sm font-medium">
            Account email
            <input
              className="rounded-lg border border-slate-300 p-2"
              type="email"
              value={shareEmail}
              onChange={(event) => setShareEmail(event.target.value)}
              maxLength={320}
              required
              disabled={isSaving}
            />
          </label>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <div className="flex gap-3">
            <button
              className="rounded-lg bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? "Sharing..." : "Share album"}
            </button>
            <button
              className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-50"
              type="button"
              onClick={() => setActiveAction(null)}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {activeAction === "public" && selectedAlbum && (
        <section className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">
            Share {selectedAlbum.name} publicly
          </h3>
          <p className="text-sm text-slate-600">
            Anyone with the link can view this album without signing in. You can
            disable the link at any time.
          </p>
          {isLoadingPublicLink ? (
            <p className="text-sm text-slate-600" role="status">
              Loading public link...
            </p>
          ) : publicLink ? (
            <>
              <input
                className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                aria-label="Public album URL"
                readOnly
                value={publicLink}
                onFocus={(event) => event.currentTarget.select()}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
                  type="button"
                  onClick={() => void copyPublicLink()}
                  disabled={isSaving}
                >
                  Copy URL
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-60"
                  type="button"
                  onClick={() => void revokePublicLink()}
                  disabled={isSaving}
                >
                  Disable public link
                </button>
              </div>
            </>
          ) : (
            <button
              className="w-fit rounded-lg bg-sky-500 px-4 py-2 font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
              type="button"
              onClick={() => void enablePublicLink()}
              disabled={isSaving || isLoadingPublicLink}
            >
              {isSaving ? "Enabling..." : "Create public link"}
            </button>
          )}
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          {status && <p className="text-sm text-green-700" role="status">{status}</p>}
          <button
            className="w-fit rounded-lg border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-50"
            type="button"
            onClick={() => setActiveAction(null)}
            disabled={isSaving}
          >
            Close
          </button>
        </section>
      )}

      {viewedAlbum && (
        <div className="mt-8">
          <ShowImage
            images={viewedAlbum.images}
            isLoading={isLoadingAlbum || isLoading}
            title={`${viewedAlbum.album.name} images`}
          />
        </div>
      )}
      {!viewedAlbum && isLoadingAlbum && (
        <p className="mt-4 text-slate-600" role="status">Loading album...</p>
      )}
    </section>
  );
}

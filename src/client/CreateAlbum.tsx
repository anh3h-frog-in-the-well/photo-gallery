"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { isAlbum, type Album } from "../interface/album";
import type { GalleryImage } from "../interface/image";

type CreateAlbumProps = {
  images: GalleryImage[];
  isLoading: boolean;
  onAlbumCreated: (album: Album) => void;
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

export default function CreateAlbum({
  images,
  isLoading,
  onAlbumCreated,
}: CreateAlbumProps) {
  const [name, setName] = useState("");
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [step, setStep] = useState<"closed" | "name" | "images">("closed");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function closeForm() {
    setStep("closed");
    setError("");
  }

  function toggleImage(imageId: string) {
    setSelectedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId],
    );
  }

  async function createAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsSaving(true);
    try {
      const response = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          imageIds: selectedImageIds,
        }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to create album."));
      }
      if (!isAlbum(payload)) {
        throw new Error("The server returned invalid album information.");
      }

      onAlbumCreated(payload);
      setName("");
      setSelectedImageIds([]);
      setStep("closed");
      setStatus(`Created "${payload.name}".`);
    } catch (saveError) {
      console.error("Unable to create album.", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to create album.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section aria-label="Create album">
      {step === "closed" ? (
        <button
          className="rounded-lg bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600"
          type="button"
          onClick={() => {
            setName("");
            setSelectedImageIds([]);
            setError("");
            setStatus("");
            setStep("name");
          }}
        >
          Create new album
        </button>
      ) : step === "name" ? (
        <form
          className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              setError("Enter a name for your album.");
              return;
            }
            setError("");
            setStep("images");
          }}
        >
          <h3 className="text-lg font-semibold">Step 1: Name your album</h3>
          <label className="grid gap-2 text-sm font-medium">
            Album name
            <input
              autoFocus
              className="rounded-lg border border-slate-300 p-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
              disabled={isSaving}
            />
          </label>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <div className="flex gap-3">
            <button
              className="rounded-lg bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600"
              type="submit"
            >
              Next: Select images
            </button>
            <button
              className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-50"
              type="button"
              onClick={closeForm}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <form
          className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={createAlbum}
        >
          <div>
            <p className="text-sm font-medium text-slate-500">
              Step 2: Select images
            </p>
            <h3 className="mt-1 text-lg font-semibold">{name.trim()}</h3>
          </div>
          {isLoading ? (
            <p className="text-sm text-slate-600">Loading images...</p>
          ) : images.length === 0 ? (
            <p className="text-sm text-slate-600">
              Upload images before adding them to an album.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image) => (
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 ${
                    selectedImageIds.includes(image.id)
                      ? "border-sky-500 bg-sky-50"
                      : "border-slate-200"
                  }`}
                  key={image.id}
                >
                  <input
                    type="checkbox"
                    checked={selectedImageIds.includes(image.id)}
                    onChange={() => toggleImage(image.id)}
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
                  <span className="min-w-0 truncate text-sm font-medium">
                    {image.title || "Untitled image"}
                  </span>
                </label>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
              type="submit"
              disabled={isSaving || isLoading || images.length === 0}
            >
              {isSaving ? "Creating..." : "Create album"}
            </button>
            <button
              className="rounded-lg bg-sky-500 px-5 py-2.5 font-semibold text-white hover:bg-sky-600"
              type="button"
              onClick={() => {
                setError("");
                setStep("name");
              }}
              disabled={isSaving}
            >
              Back
            </button>
            <button
              className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold hover:bg-slate-50"
              type="button"
              onClick={closeForm}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {step === "closed" && error && (
        <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>
      )}
      {step === "closed" && status && (
        <p className="mt-4 text-sm text-green-700" role="status">{status}</p>
      )}
    </section>
  );
}

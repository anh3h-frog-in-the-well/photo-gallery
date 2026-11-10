"use client";

import { useRef, useState, type FormEvent } from "react";
import { isGalleryImage, type GalleryImage } from "../interface/image";

type UploadImageProps = {
  onUploaded: (image: GalleryImage) => void;
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

export default function UploadImage({ onUploaded }: UploadImageProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsUploading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/images", {
        method: "POST",
        body: formData,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to upload image."));
      }
      if (!isGalleryImage(payload)) {
        throw new Error("The server returned invalid image information.");
      }

      onUploaded(payload);
      formRef.current?.reset();
      setStatus("Image uploaded successfully.");
    } catch (uploadError) {
      console.error("Unable to upload image.", uploadError);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload image.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="mt-10">
      {isFormOpen && (
        <form
          ref={formRef}
          className="mb-4 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={handleUpload}
        >
          <h2 className="text-lg font-semibold">Upload one image</h2>
          <label className="grid gap-2 text-sm font-medium">
            Image
            <input
              className="rounded-lg border border-slate-300 p-2"
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/gif,image/webp"
              required
              disabled={isUploading}
            />
            <span className="font-normal text-slate-500">
              JPEG, PNG, GIF, or WebP. Maximum file size: 10 MB.
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium">
              Title <span className="font-normal text-slate-500">Optional</span>
              <input
                className="rounded-lg border border-slate-300 p-2"
                type="text"
                name="title"
                maxLength={255}
                disabled={isUploading}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Place <span className="font-normal text-slate-500">Optional</span>
              <input
                className="rounded-lg border border-slate-300 p-2"
                type="text"
                name="place"
                maxLength={255}
                disabled={isUploading}
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Note <span className="font-normal text-slate-500">Optional</span>
            <textarea
              className="min-h-24 rounded-lg border border-slate-300 p-2"
              name="note"
              maxLength={5000}
              disabled={isUploading}
            />
          </label>
          <div>
            <button
              className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={isUploading}
            >
              {isUploading ? "Uploading..." : "Save image"}
            </button>
          </div>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          {status && <p className="text-sm text-green-700" role="status">{status}</p>}
        </form>
      )}
      {!isFormOpen && error && (
        <p className="mb-4 text-sm text-red-700" role="alert">{error}</p>
      )}
      <button
        className={`rounded-lg px-5 py-2.5 font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
          isFormOpen
            ? "border border-slate-300 hover:bg-slate-50"
            : "bg-sky-500 text-white hover:bg-sky-600"
        }`}
        type="button"
        disabled={isUploading}
        onClick={() => {
          setIsFormOpen((isOpen) => !isOpen);
          setError("");
          setStatus("");
        }}
      >
        {isFormOpen ? "Cancel upload" : "Upload image"}
      </button>
    </section>
  );
}

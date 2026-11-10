export type GalleryImage = {
  id: string;
  title: string | null;
  place: string | null;
  note: string | null;
  created_at: string;
};

export function isGalleryImage(value: unknown): value is GalleryImage {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "title" in value &&
    (typeof value.title === "string" || value.title === null) &&
    "place" in value &&
    (typeof value.place === "string" || value.place === null) &&
    "note" in value &&
    (typeof value.note === "string" || value.note === null) &&
    "created_at" in value &&
    typeof value.created_at === "string"
  );
}

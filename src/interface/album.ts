export type Album = {
  id: string;
  name: string;
  image_ids: string[];
  created_at: string;
  can_edit: boolean;
  owner_name: string | null;
};

export function isAlbum(value: unknown): value is Album {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "image_ids" in value &&
    Array.isArray(value.image_ids) &&
    value.image_ids.every((id) => typeof id === "string") &&
    "created_at" in value &&
    typeof value.created_at === "string" &&
    "can_edit" in value &&
    typeof value.can_edit === "boolean" &&
    "owner_name" in value &&
    (typeof value.owner_name === "string" || value.owner_name === null)
  );
}

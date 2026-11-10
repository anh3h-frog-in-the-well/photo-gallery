import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import {
  ImageUploadError,
  listImages,
  saveImage,
} from "../../../service/image-service";

const maxImageSize = 10 * 1024 * 1024;
const maxRequestSize = maxImageSize + 32 * 1024;

function readOptionalText(formData: FormData, key: string, maxLength: number) {
  const value = formData.get(key);
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ImageUploadError(`The ${key} field is invalid.`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new ImageUploadError(
      `The ${key} field must be ${maxLength} characters or fewer.`,
      400,
    );
  }
  return trimmed || null;
}

export async function GET() {
  const session = await auth();
  const accountId = session?.user?.id;
  if (!accountId) {
    return NextResponse.json({ error: "Sign in to view your images." }, { status: 401 });
  }

  try {
    return NextResponse.json(await listImages(accountId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Unable to load gallery images.", error);
    return NextResponse.json(
      { error: "Unable to load your images." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const accountId = session?.user?.id;
  if (!accountId) {
    return NextResponse.json({ error: "Sign in to upload images." }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maxRequestSize) {
    return NextResponse.json(
      { error: "Images must be 10 MB or smaller." },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "The upload request is not valid multipart form data." },
      { status: 400 },
    );
  }

  try {
    const imageEntries = formData.getAll("image");
    const fileEntries = Array.from(formData.values()).filter(
      (value) => value instanceof File,
    );
    if (
      imageEntries.length !== 1 ||
      !(imageEntries[0] instanceof File) ||
      fileEntries.length !== 1
    ) {
      throw new ImageUploadError("Select exactly one image to upload.", 400);
    }

    const title = readOptionalText(formData, "title", 255);
    const place = readOptionalText(formData, "place", 255);
    const note = readOptionalText(formData, "note", 5000);
    const image = await saveImage(accountId, imageEntries[0], {
      title,
      place,
      note,
    });
    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("Unable to upload image.", error);
    return NextResponse.json(
      { error: "Unable to upload the image. Please try again." },
      { status: 500 },
    );
  }
}

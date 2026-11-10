import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import {
  AlbumServiceError,
  getAlbumImages,
  updateAlbumImages,
} from "../../../../service/album-service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accountId = (await auth())?.user?.id;
  if (!accountId) {
    return NextResponse.json({ error: "Sign in to view albums." }, { status: 401 });
  }
  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }
  try {
    return NextResponse.json(await getAlbumImages(accountId, id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof AlbumServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to load album images.", error);
    return NextResponse.json({ error: "Unable to load album images." }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accountId = (await auth())?.user?.id;
  if (!accountId) {
    return NextResponse.json({ error: "Sign in to update albums." }, { status: 401 });
  }
  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (
    !isRecord(body) ||
    typeof body.name !== "string" ||
    !Array.isArray(body.imageIds) ||
    !body.imageIds.every((imageId) => typeof imageId === "string") ||
    body.imageIds.length > 500
  ) {
    return NextResponse.json(
      { error: "Provide an album name and a list of at most 500 image IDs." },
      { status: 400 },
    );
  }
  const name = body.name.trim();
  if (!name || name.length > 255) {
    return NextResponse.json(
      { error: "Album name is required and must be at most 255 characters." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await updateAlbumImages(accountId, id, name, body.imageIds),
    );
  } catch (error) {
    if (error instanceof AlbumServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to update album.", error);
    return NextResponse.json({ error: "Unable to update album." }, { status: 500 });
  }
}

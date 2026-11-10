import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import {
  AlbumServiceError,
  createAlbum,
  listAlbums,
} from "../../../service/album-service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET() {
  const accountId = (await auth())?.user?.id;
  if (!accountId) {
    return NextResponse.json({ error: "Sign in to view your albums." }, { status: 401 });
  }
  try {
    return NextResponse.json(await listAlbums(accountId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Unable to load albums.", error);
    return NextResponse.json({ error: "Unable to load your albums." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const accountId = (await auth())?.user?.id;
  if (!accountId) {
    return NextResponse.json({ error: "Sign in to create albums." }, { status: 401 });
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
    !body.imageIds.every((id) => typeof id === "string")
  ) {
    return NextResponse.json(
      { error: "Provide an album name and a list of image IDs." },
      { status: 400 },
    );
  }
  const name = body.name.trim();
  if (name.length === 0 || name.length > 255 || body.imageIds.length > 500) {
    return NextResponse.json(
      { error: "Album name is required and must be at most 255 characters; select at most 500 images." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await createAlbum(accountId, name, body.imageIds),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AlbumServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to create album.", error);
    return NextResponse.json({ error: "Unable to create album." }, { status: 500 });
  }
}

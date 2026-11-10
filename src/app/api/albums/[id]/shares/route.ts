import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import {
  AlbumServiceError,
  shareAlbum,
} from "../../../../../service/album-service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const accountId = (await auth())?.user?.id;
  if (!accountId) {
    return NextResponse.json({ error: "Sign in to share albums." }, { status: 401 });
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
  if (!isRecord(body) || typeof body.email !== "string") {
    return NextResponse.json({ error: "Provide the recipient's email address." }, { status: 400 });
  }

  const email = body.email.trim().toLowerCase();
  if (
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    return NextResponse.json(await shareAlbum(accountId, id, email), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof AlbumServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to share album.", error);
    return NextResponse.json({ error: "Unable to share album." }, { status: 500 });
  }
}

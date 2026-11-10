import { NextResponse } from "next/server";
import { AlbumServiceError, getPublicAlbum } from "../../../../../service/album-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/i.test(token)) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }
  try {
    return NextResponse.json(await getPublicAlbum(token), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof AlbumServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to load public album.", error);
    return NextResponse.json(
      { error: "Unable to load public album." },
      { status: 500 },
    );
  }
}

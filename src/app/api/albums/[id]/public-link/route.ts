import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import {
  AlbumServiceError,
  enableAlbumPublicLink,
  getAlbumPublicLink,
  revokeAlbumPublicLink,
} from "../../../../../service/album-service";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getOwnerAlbumId(params: Promise<{ id: string }>) {
  const accountId = (await auth())?.user?.id;
  if (!accountId) {
    return {
      error: NextResponse.json(
        { error: "Sign in to manage public album links." },
        { status: 401 },
      ),
    };
  }
  const { id } = await params;
  if (!uuidPattern.test(id)) {
    return {
      error: NextResponse.json({ error: "Album not found." }, { status: 404 }),
    };
  }
  return { accountId, id };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getOwnerAlbumId(params);
  if ("error" in owner) return owner.error;
  try {
    return NextResponse.json(await getAlbumPublicLink(owner.accountId, owner.id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof AlbumServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to load public album link.", error);
    return NextResponse.json(
      { error: "Unable to load public album link." },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getOwnerAlbumId(params);
  if ("error" in owner) return owner.error;
  try {
    return NextResponse.json(
      await enableAlbumPublicLink(owner.accountId, owner.id),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AlbumServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to enable public album link.", error);
    return NextResponse.json(
      { error: "Unable to enable public album link." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const owner = await getOwnerAlbumId(params);
  if ("error" in owner) return owner.error;
  try {
    await revokeAlbumPublicLink(owner.accountId, owner.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AlbumServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to revoke public album link.", error);
    return NextResponse.json(
      { error: "Unable to revoke public album link." },
      { status: 500 },
    );
  }
}

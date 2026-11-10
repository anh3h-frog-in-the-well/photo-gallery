import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { readImage } from "../../../../../service/image-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const accountId = session?.user?.id ?? null;
  const publicToken = new URL(request.url).searchParams.get("publicToken");
  const hasValidPublicToken =
    publicToken !== null && /^[0-9a-f]{64}$/i.test(publicToken);
  if (!accountId && !hasValidPublicToken) {
    return NextResponse.json({ error: "Sign in to view this image." }, { status: 401 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  try {
    const image = await readImage(
      accountId,
      id,
      hasValidPublicToken ? publicToken : undefined,
    );
    if (!image) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(image.buffer), {
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(image.buffer.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Unable to read stored image.", error);
    return NextResponse.json(
      { error: "Unable to load this image." },
      { status: 500 },
    );
  }
}

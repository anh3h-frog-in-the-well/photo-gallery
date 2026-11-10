import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((request) => {
  if (request.auth?.user?.id) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication is required to access your gallery." },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/"],
};

import { Suspense } from "react";
import PublicAlbum from "../../../client/PublicAlbum";

export default function SharedAlbumPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background p-6 text-foreground sm:p-10">
          <p className="mx-auto max-w-6xl text-slate-600">Loading album...</p>
        </main>
      }
    >
      <PublicAlbum />
    </Suspense>
  );
}

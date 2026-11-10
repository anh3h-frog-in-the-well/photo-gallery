import type { Metadata } from "next";
import AuthSessionProvider from "../client/AuthSessionProvider";
import "./globals.css";



export const metadata: Metadata = {
  title: "Photo Gallery",
  description: "A personal gallery for your images.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}

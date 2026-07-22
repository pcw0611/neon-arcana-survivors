import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "neon-arcana-survivors.pcwww.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "Neon Arcana: Cyber Rift";
  const description = "빌드와 유물을 완성하며 끝없는 균열에서 살아남는 사이버펑크 생존 액션 게임";
  return {
    metadataBase,
    title,
    description,
    openGraph: { title, description, images: [{ url: "/og-v2.png", width: 1536, height: 1024, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og-v2.png"] },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "neon-arcana-survivors.pcwww.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "Neon Arcana: Cyber Rift";
  const description = "보스전과 글로벌 랭킹이 있는 3분 사이버펑크 생존 액션 게임";
  return {
    metadataBase,
    title,
    description,
    openGraph: { title, description, images: [{ url: "/og.png", width: 1672, height: 941, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}

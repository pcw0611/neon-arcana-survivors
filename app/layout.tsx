import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"Neon Arcana — 모바일 생존 게임", description:"도시의 균열에서 살아남는 모던 판타지 웹게임" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}

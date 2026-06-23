import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "클럽 대진표 조회",
  description: "BKPLAY 지역별 대회에서 입력한 클럽명이 포함된 대진표를 찾아보는 웹앱"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

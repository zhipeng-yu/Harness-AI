import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "超体 · 我的成长操作系统",
  description: "本地个人成长操作系统",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <header className="site-header">
          <div className="site-header__inner">
            <p className="site-header__brand">超体 · 本地个人成长系统</p>
            <p className="site-header__note">Local · Private · Evolving</p>
          </div>
        </header>
        <nav className="primary-nav" aria-label="主导航">
          <Link href="/">我的首页</Link>
          <Link href="/chapters">18章地图</Link>
          <Link href="/system">我的系统</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}

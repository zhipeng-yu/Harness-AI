import type { ReactNode } from "react";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <p className="site-header__brand">超体 · 本地个人成长系统</p>
          <p className="site-header__note">Local · Private · Evolving</p>
        </div>
      </header>
      {children}
    </>
  );
}

import type { ReactNode } from "react";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <header>超体 · 本地个人成长系统</header>
      {children}
    </>
  );
}

import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("phase-one application shell", () => {
  it("identifies itself as a personal growth operating system", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { name: "超体 · 我的成长操作系统" }),
    ).toBeInTheDocument();
  });
});

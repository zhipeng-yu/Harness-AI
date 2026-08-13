import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutosaveField } from "@/src/components/autosave-field";

describe("AutosaveField", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("saves 800ms after typing stops", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ updatedAt: "2026-08-13T00:00:00.000Z" })),
    );

    render(
      <AutosaveField
        chapterId="chapter-01"
        promptId="chapter-01-reflection-01"
        label="我的现实问题"
        initialValue=""
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "草稿" } });
    await act(async () => vi.advanceTimersByTimeAsync(400));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "真实场景" } });
    await act(async () => vi.advanceTimersByTimeAsync(799));
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/responses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId: "chapter-01",
        promptId: "chapter-01-reflection-01",
        value: "真实场景",
      }),
      signal: expect.any(AbortSignal),
    });
    expect(screen.getByText("已保存")).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(1_600));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps failed text and retries immediately", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ updatedAt: "2026-08-13T00:00:00.000Z" })),
      );
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    render(
      <AutosaveField
        chapterId="chapter-01"
        promptId="chapter-01-reflection-01"
        label="我的现实问题"
        initialValue=""
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "不能丢失的回答" } });
    await act(async () => vi.advanceTimersByTimeAsync(800));

    expect(screen.getByRole("textbox")).toHaveValue("不能丢失的回答");
    expect(screen.getByRole("button", { name: "重试保存" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("textbox")).toHaveValue("不能丢失的回答");
    expect(screen.getByText("已保存")).toBeInTheDocument();
    expect(removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("cancels a pending debounce when retrying and remains retryable after failure", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      if (init?.signal) signals.push(init.signal);
      const attempt = signals.length;
      if (attempt < 3) return Promise.resolve(new Response(null, { status: 500 }));
      return Promise.resolve(
        new Response(JSON.stringify({ updatedAt: "2026-08-13T00:00:00.000Z" })),
      );
    });

    render(
      <AutosaveField
        chapterId="chapter-01"
        promptId="chapter-01-reflection-01"
        label="我的现实问题"
        initialValue=""
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "首次失败" } });
    await act(async () => vi.advanceTimersByTimeAsync(800));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "等待防抖的新值" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "重试保存" })).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signals[0].aborted).toBe(true);
    expect(screen.queryByText("保存中…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试保存" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "重试保存" }));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByText("已保存")).toBeInTheDocument();
  });

  it("returns to idle when failed text is restored to the saved baseline", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 500 }));

    render(
      <AutosaveField
        chapterId="chapter-01"
        promptId="chapter-01-reflection-01"
        label="我的现实问题"
        initialValue="已保存回答"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "失败修改" } });
    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(screen.getByRole("button", { name: "重试保存" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "已保存回答" } });
    await act(async () => Promise.resolve());

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试保存" })).not.toBeInTheDocument();
    expect(screen.queryByText("保存中…")).not.toBeInTheDocument();
    expect(screen.queryByText("已保存")).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not show an error when a superseded request is aborted", async () => {
    vi.useFakeTimers();
    let supersededSignal: AbortSignal | undefined;
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce((_input, init) => {
        supersededSignal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Superseded", "AbortError"));
          });
        });
      })
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ updatedAt: "2026-08-13T00:00:00.000Z" })),
      );

    render(
      <AutosaveField
        chapterId="chapter-01"
        promptId="chapter-01-reflection-01"
        label="我的现实问题"
        initialValue=""
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "旧回答" } });
    await act(async () => vi.advanceTimersByTimeAsync(800));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "新回答" } });
    await act(async () => Promise.resolve());

    expect(supersededSignal?.aborted).toBe(true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("已保存")).toBeInTheDocument();
  });

  it("leaves saving state when an in-flight change is reverted to the saved value", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Reverted", "AbortError"));
        });
      }),
    );

    render(
      <AutosaveField
        chapterId="chapter-01"
        promptId="chapter-01-reflection-01"
        label="我的现实问题"
        initialValue="原回答"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "临时修改" } });
    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(screen.getByText("保存中…")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "原回答" } });
    await act(async () => Promise.resolve());

    expect(screen.queryByText("保存中…")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "再次修改" } });
    expect(screen.queryByText("保存中…")).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(799));
    expect(screen.queryByText("保存中…")).not.toBeInTheDocument();

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByText("保存中…")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("leaves saving state when an aborted request resolves late", async () => {
    vi.useFakeTimers();
    let resolveRequest!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    render(
      <AutosaveField
        chapterId="chapter-01"
        promptId="chapter-01-reflection-01"
        label="我的现实问题"
        initialValue="原回答"
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "临时修改" } });
    await act(async () => vi.advanceTimersByTimeAsync(800));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "原回答" } });

    await act(async () => {
      resolveRequest(new Response(JSON.stringify({ updatedAt: "2026-08-13T00:00:00.000Z" })));
      await Promise.resolve();
    });

    expect(screen.queryByText("保存中…")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["an empty body", () => new Response(null)],
    ["HTML", () => new Response("<html>not json</html>")],
    ["missing updatedAt", () => new Response(JSON.stringify({}))],
    ["an invalid updatedAt", () => new Response(JSON.stringify({ updatedAt: "yesterday" }))],
  ])("rejects a 2xx response with %s", async (_case, makeResponse) => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(makeResponse());

    render(
      <AutosaveField
        chapterId="chapter-01"
        promptId="chapter-01-reflection-01"
        label="我的现实问题"
        initialValue=""
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "不能误报成功" } });
    await act(async () => vi.advanceTimersByTimeAsync(800));

    expect(screen.queryByText("已保存")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("不能误报成功");
    expect(screen.getByRole("button", { name: "重试保存" })).toBeInTheDocument();
  });

  it("registers beforeunload only while the response is dirty", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ updatedAt: "2026-08-13T00:00:00.000Z" })),
    );
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(
      <AutosaveField
        chapterId="chapter-01"
        promptId="chapter-01-reflection-01"
        label="我的现实问题"
        initialValue=""
      />,
    );

    expect(addEventListener).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "尚未保存" } });
    expect(addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    await act(async () => vi.advanceTimersByTimeAsync(800));
    expect(removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "再次修改" } });
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });
});

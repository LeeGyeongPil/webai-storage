// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ModelStoragePanel } from "../../src/react/index.js";
import { MINILM, makeEnv } from "../helpers.js";

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("panel language (AC-8)", () => {
  it("renders each language from the lang prop and hides the menu", async () => {
    const env = await makeEnv();
    const { unmount } = render(<ModelStoragePanel env={env} lang="ko" />);
    await screen.findByText(MINILM);
    expect(screen.getByText("저장된 AI 모델")).toBeTruthy();
    expect(screen.getByText("저장소 사용량 (근사치)")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    unmount();
    render(<ModelStoragePanel env={env} lang="en" />);
    await screen.findByText(MINILM);
    expect(screen.getByText("Stored AI models")).toBeTruthy();
  });

  it("stores the menu choice in localStorage and keeps it across re-renders", async () => {
    const env = await makeEnv();
    const first = render(<ModelStoragePanel env={env} />);
    await screen.findByText(MINILM);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ko" } });
    expect(localStorage.getItem("webai-storage.lang")).toBe("ko");
    expect(screen.getByText("저장된 AI 모델")).toBeTruthy();
    first.unmount();
    render(<ModelStoragePanel env={env} />);
    await screen.findByText(MINILM);
    expect(screen.getByText("저장된 AI 모델")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "en" } });
    expect(screen.getByText("Stored AI models")).toBeTruthy();
    expect(localStorage.getItem("webai-storage.lang")).toBe("en");
  });

  it("detects navigator.language only when nothing is stored", async () => {
    const env = await makeEnv();
    const original = Object.getOwnPropertyDescriptor(globalThis.navigator, "language");
    Object.defineProperty(globalThis.navigator, "language", { value: "ko-KR", configurable: true });
    try {
      const a = render(<ModelStoragePanel env={env} />);
      await screen.findByText(MINILM);
      expect(screen.getByText("저장된 AI 모델")).toBeTruthy();
      a.unmount();
      localStorage.setItem("webai-storage.lang", "en");
      render(<ModelStoragePanel env={env} />);
      await screen.findByText(MINILM);
      expect(screen.getByText("Stored AI models")).toBeTruthy();
    } finally {
      if (original) Object.defineProperty(globalThis.navigator, "language", original);
    }
  });
});

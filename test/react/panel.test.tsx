// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { cacheApiAdapter } from "../../src/index.js";
import { ModelStoragePanel } from "../../src/react/index.js";
import { MINILM, SMOL, makeEnv } from "../helpers.js";

afterEach(() => cleanup());

describe("ModelStoragePanel (AC-7)", () => {
  it("lists models largest first with an approximate usage bar and a partial badge", async () => {
    const env = await makeEnv();
    render(<ModelStoragePanel env={env} lang="en" />);
    await screen.findByText(MINILM);
    const names = screen.getAllByRole("listitem").map((li) => li.getAttribute("data-model"));
    expect(names).toEqual([MINILM, SMOL]);
    expect(screen.getByText("Storage used (approximate)")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("41");
    expect(screen.getByText("partial")).toBeTruthy();
    expect(screen.getByText(/23\.7 MB/)).toBeTruthy();
  });

  it("deletes a model after confirmation, refreshes and calls onRemoved", async () => {
    const env = await makeEnv();
    const onRemoved = vi.fn();
    render(<ModelStoragePanel env={env} lang="en" onRemoved={onRemoved} />);
    await screen.findByText(MINILM);
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: "Yes, delete" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Freed 23.7 MB"));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(onRemoved).toHaveBeenCalledWith(MINILM);
    expect(screen.getAllByRole("listitem")[0]?.getAttribute("data-model")).toBe(SMOL);
  });

  it("shows a localized alert when a delete fails (Q-2)", async () => {
    const env = await makeEnv();
    const adapters = [
      {
        ...cacheApiAdapter(),
        remove: async () => {
          throw new Error("locked by another tab");
        },
      },
    ];
    const onRemoved = vi.fn();
    render(<ModelStoragePanel env={env} adapters={adapters} lang="en" onRemoved={onRemoved} />);
    await screen.findByText(MINILM);
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]!);
    fireEvent.click(await screen.findByRole("button", { name: "Yes, delete" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Could not delete " + MINILM);
    expect(alert.textContent).toContain("locked by another tab");
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("cancel keeps the model", async () => {
    const env = await makeEnv();
    render(<ModelStoragePanel env={env} lang="en" />);
    await screen.findByText(MINILM);
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("persist button shows the refusal as information, not an error", async () => {
    const env = await makeEnv();
    render(<ModelStoragePanel env={env} lang="en" />);
    await screen.findByText(MINILM);
    fireEvent.click(screen.getByRole("button", { name: "Request persistent storage" }));
    await screen.findByText(/this is not an error/);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("persist button works when the browser grants", async () => {
    const env = await makeEnv({ cacheApi: true }, { usage: 1, quota: 100, grant: true });
    render(<ModelStoragePanel env={env} lang="en" />);
    await screen.findByText(MINILM);
    fireEvent.click(screen.getByRole("button", { name: "Request persistent storage" }));
    await screen.findByText(/^Granted\./);
    await screen.findByText("Persistent storage: granted");
  });

  it("shows the empty state and an unknown-estimate note", async () => {
    const env = await makeEnv({}, {});
    render(<ModelStoragePanel env={env} lang="en" />);
    await screen.findByText("No stored models found.");
    expect(screen.getByText("Storage estimate is not available in this browser.")).toBeTruthy();
  });
});

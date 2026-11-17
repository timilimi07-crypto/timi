// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHotkeys } from "./use-hotkeys";

const press = (key: string, init: KeyboardEventInit = {}) => window.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true, ...init }));

describe("useHotkeys", () => {
  it("löst einzelne Tasten, Kombinationen und Sequenzen aus", () => {
    const j = vi.fn(), modK = vi.fn(), gi = vi.fn();
    renderHook(() => useHotkeys({ j, "mod+k": modK, "g i": gi }));
    press("j");
    press("k", { metaKey: true });
    press("g");
    press("i");
    expect([j.mock.calls.length, modK.mock.calls.length, gi.mock.calls.length]).toEqual([1, 1, 1]);
  });

  it("globale Sequenz „g e“ löst nicht zusätzlich „e“ der Seite aus", () => {
    const globalGe = vi.fn(), pageE = vi.fn();
    renderHook(() => useHotkeys({ e: pageE })); // Seite (bubble, wird zuerst registriert)
    renderHook(() => useHotkeys({ "g e": globalGe }, true, { capture: true })); // global
    press("g");
    press("e");
    expect(globalGe).toHaveBeenCalledTimes(1);
    expect(pageE).not.toHaveBeenCalled();
    press("e");
    expect(pageE).toHaveBeenCalledTimes(1);
  });

  it("ignoriert Tasten in Eingabefeldern (außer mit ⌘/Strg)", () => {
    const slash = vi.fn(), modK = vi.fn();
    renderHook(() => useHotkeys({ "/": slash, "mod+k": modK }));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "/", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    expect(slash).not.toHaveBeenCalled();
    expect(modK).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeKey, keyFromEvent } from "../src/plugins/keybindings";

describe("normalizeKey", () => {
  it("normalizes ctrl/meta/cmd to mod", () => {
    expect(normalizeKey("ctrl+shift+p")).toBe("mod+shift+p");
    expect(normalizeKey("cmd+shift+p")).toBe("mod+shift+p");
    expect(normalizeKey("Ctrl+Shift+T")).toBe("mod+shift+t");
  });

  it("keeps alt and plain keys", () => {
    expect(normalizeKey("alt+k")).toBe("alt+k");
    expect(normalizeKey("f5")).toBe("f5");
  });

  it("orders modifiers consistently", () => {
    expect(normalizeKey("alt+ctrl+k")).toBe("mod+alt+k");
    expect(normalizeKey("shift+alt+ctrl+k")).toBe("mod+shift+alt+k");
  });
});

describe("keyFromEvent", () => {
  it("maps event to normalized key", () => {
    const e = {
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
      altKey: false,
      key: "T",
      code: "KeyT",
    } as unknown as KeyboardEvent;
    expect(keyFromEvent(e)).toBe("mod+shift+t");
  });

  it("uses code for special keys", () => {
    const e = {
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      key: "ArrowDown",
      code: "ArrowDown",
    } as unknown as KeyboardEvent;
    expect(keyFromEvent(e)).toBe("mod+arrowdown");
  });

  it("maps space", () => {
    const e = {
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      key: " ",
      code: "Space",
    } as unknown as KeyboardEvent;
    expect(keyFromEvent(e)).toBe("space");
  });
});

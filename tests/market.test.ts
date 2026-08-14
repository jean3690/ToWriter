import { describe, expect, it } from "vitest";
import { pluginNameFromEntry, type RemotePluginEntry } from "../src/services/marketService";

describe("pluginNameFromEntry", () => {
  it("uses last path segment", () => {
    const e: RemotePluginEntry = {
      name: "grammar-hint",
      displayName: "中文语法提示",
      version: "0.1.0",
      publisher: "p",
      description: "",
      repo: "owner/repo",
      path: "plugins/grammar-hint",
    };
    expect(pluginNameFromEntry(e)).toBe("grammar-hint");
  });

  it("falls back to name when path is shallow", () => {
    const e: RemotePluginEntry = {
      name: "word-count",
      displayName: "",
      version: "0.1.0",
      publisher: "p",
      description: "",
      repo: "owner/repo",
      path: "word-count",
    };
    expect(pluginNameFromEntry(e)).toBe("word-count");
  });

  it("tolerates trailing slash", () => {
    const e: RemotePluginEntry = {
      name: "x",
      displayName: "",
      version: "0.1.0",
      publisher: "p",
      description: "",
      repo: "owner/repo",
      path: "plugins/x/",
    };
    expect(pluginNameFromEntry(e)).toBe("x");
  });
});

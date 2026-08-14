import { describe, expect, it } from "vitest";
import { countWords } from "../src/services/wordCount";

describe("countWords", () => {
  it("counts every CJK character as one word", () => {
    expect(countWords("你好世界")).toBe(4);
  });

  it("counts consecutive latin words as one", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("helloworld")).toBe(1);
  });

  it("treats ascii digits as part of a word", () => {
    expect(countWords("abc123")).toBe(1);
    expect(countWords("abc 123")).toBe(2);
  });

  it("ignores punctuation and whitespace", () => {
    expect(countWords("你好，世界！")).toBe(4);
    expect(countWords("a, b. c!")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });

  it("handles mixed CJK and latin", () => {
    expect(countWords("你好world世界")).toBe(5);
    expect(countWords("你好 world 世界")).toBe(5);
  });

  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });
});

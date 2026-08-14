import { describe, expect, it } from "vitest";
import { parseIssues } from "../src/ai/consistency";

describe("parseIssues", () => {
  it("parses a plain JSON array", () => {
    const raw = JSON.stringify([
      {
        level: "高",
        chapter: "第一章",
        quote: "原文",
        issue: "问题",
        suggestion: "建议",
      },
    ]);
    const issues = parseIssues(raw);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      level: "高",
      chapter: "第一章",
      quote: "原文",
      issue: "问题",
      suggestion: "建议",
    });
  });

  it("strips fenced code fences", () => {
    const raw = "```json\n" + JSON.stringify([{ level: "中", chapter: "第二章", quote: "", issue: "x", suggestion: "" }]) + "\n```";
    const issues = parseIssues(raw);
    expect(issues).toHaveLength(1);
    expect(issues[0].chapter).toBe("第二章");
  });

  it("returns empty array for []", () => {
    expect(parseIssues("[]")).toEqual([]);
  });

  it("normalizes unknown levels to 低", () => {
    const issues = parseIssues('[{"level":"?","chapter":"c","quote":"","issue":"","suggestion":""}]');
    expect(issues[0].level).toBe("低");
  });

  it("coerces missing fields to empty strings", () => {
    const issues = parseIssues('[{"level":"高"}]');
    expect(issues[0]).toMatchObject({ chapter: "", quote: "", issue: "", suggestion: "" });
  });

  it("returns [] for malformed JSON", () => {
    expect(parseIssues("not json at all")).toEqual([]);
  });

  it("returns [] for non-array JSON", () => {
    expect(parseIssues('{"a":1}')).toEqual([]);
  });
});

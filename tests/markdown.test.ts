import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/services/markdown";

describe("renderMarkdown", () => {
  it("renders headings", () => {
    const html = renderMarkdown("# 第一章");
    expect(html).toContain("<h1>第一章</h1>");
  });

  it("renders paragraphs", () => {
    const html = renderMarkdown("你好世界");
    expect(html).toContain("<p>你好世界</p>");
  });

  it("renders inline bold and italic", () => {
    const html = renderMarkdown("**粗体**和*斜体*");
    expect(html).toContain("<strong>粗体</strong>");
    expect(html).toContain("<em>斜体</em>");
  });

  it("renders inline code", () => {
    const html = renderMarkdown("`code`");
    expect(html).toContain("<code>code</code>");
  });

  it("renders links", () => {
    const html = renderMarkdown("[文字](https://example.com)");
    expect(html).toContain('<a href="https://example.com">文字</a>');
  });

  it("renders unordered lists", () => {
    const html = renderMarkdown("- 甲\n- 乙");
    expect(html).toContain("<ul><li>甲</li><li>乙</li></ul>");
  });

  it("renders ordered lists", () => {
    const html = renderMarkdown("1. 一\n2. 二");
    expect(html).toContain("<ol><li>一</li><li>二</li></ol>");
  });

  it("renders blockquote", () => {
    const html = renderMarkdown("> 引用");
    expect(html).toContain("<blockquote>引用</blockquote>");
  });

  it("renders horizontal rule", () => {
    const html = renderMarkdown("---");
    expect(html).toContain("<hr>");
  });

  it("escapes html in content", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("handles fenced code blocks", () => {
    const html = renderMarkdown("```\nconst a = 1;\n```");
    expect(html).toContain("<pre><code>");
    expect(html).toContain("const a = 1;");
  });
});

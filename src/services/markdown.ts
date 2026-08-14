function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text: string): string {
  let t = escapeHtml(text);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

export function renderMarkdown(src: string): string {
  const lines = src.split("\n");
  const html: string[] = [];
  let i = 0;
  let inCode = false;
  let codeBuf: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeBuf = [];
      } else {
        inCode = false;
        html.push(`<pre><code>${codeBuf.join("\n").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>`);
      }
      i += 1;
      continue;
    }

    if (inCode) {
      codeBuf.push(line);
      i += 1;
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    let m = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      const level = m[1].length;
      html.push(`<h${level}>${inline(m[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      html.push("<hr>");
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(inline(lines[i].trim().replace(/^>\s?/, "")));
        i += 1;
      }
      html.push(`<blockquote>${quote.join("<br>")}</blockquote>`);
      continue;
    }

    m = trimmed.match(/^[-*+]\s+(.*)$/);
    if (m) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const item = t.match(/^[-*+]\s+(.*)$/);
        if (item) {
          items.push(`<li>${inline(item[1])}</li>`);
          i += 1;
        } else {
          break;
        }
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    m = trimmed.match(/^\d+\.\s+(.*)$/);
    if (m) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const item = t.match(/^\d+\.\s+(.*)$/);
        if (item) {
          items.push(`<li>${inline(item[1])}</li>`);
          i += 1;
        } else {
          break;
        }
      }
      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6})\s/.test(lines[i].trim()) && !lines[i].startsWith("```")) {
      para.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${para.map(inline).join("<br>")}</p>`);
  }

  if (inCode && codeBuf.length) {
    html.push(`<pre><code>${codeBuf.join("\n").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>`);
  }

  return html.join("\n");
}

export function countWords(text: string): number {
  let count = 0;
  let inWord = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x4e00 && cp <= 0x9fff) {
      count += 1;
      inWord = false;
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      if (!inWord) {
        count += 1;
        inWord = true;
      }
    } else {
      inWord = false;
    }
  }
  return count;
}

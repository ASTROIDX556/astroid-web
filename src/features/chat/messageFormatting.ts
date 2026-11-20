export type MessageSegment =
  | { kind: 'text'; value: string }
  | { kind: 'code'; language: string; value: string };

const CODE_FENCE = /```([\w+#.-]*)\n?([\s\S]*?)```/g;

/** Split complete fenced snippets from assistant text; incomplete fences stay text while streaming. */
export function splitMessageSegments(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let cursor = 0;

  for (const match of content.matchAll(CODE_FENCE)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      segments.push({ kind: 'text', value: content.slice(cursor, index) });
    }
    segments.push({
      kind: 'code',
      language: (match[1] ?? '').trim(),
      value: (match[2] ?? '').replace(/\n$/, ''),
    });
    cursor = index + match[0].length;
  }

  if (cursor < content.length) {
    segments.push({ kind: 'text', value: content.slice(cursor) });
  }

  return segments;
}

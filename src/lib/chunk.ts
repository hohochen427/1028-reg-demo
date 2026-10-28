/**
 * Parsing ＋ Chunking：把一份 Markdown 文件切成適合檢索的小塊。
 * 用 Structure-aware Chunking：先照標題切，標題本身帶進 Chunk 正文，
 * 太長再往下用段落切——這樣每一塊單獨拿出來看，還是看得懂它在說什麼。
 */

export interface RawSection {
  section: string;
  body: string;
}

/** 把 Markdown 解析成「章節 ＋ 正文」 */
export function parseMarkdown(markdown: string): { docTitle: string; sections: RawSection[] } {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let docTitle = '';
  let current: RawSection | null = null;
  const sections: RawSection[] = [];

  const flush = () => {
    if (current && current.body.trim().length > 0) sections.push(current);
    current = null;
  };

  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      flush();
      docTitle = line.replace(/^#\s+/, '').trim();
      continue;
    }
    if (/^#{2,}\s+/.test(line)) {
      flush();
      current = { section: line.replace(/^#{2,}\s+/, '').trim(), body: '' };
      continue;
    }
    if (!current) current = { section: docTitle || '前言', body: '' };
    current.body += line + '\n';
  }
  flush();
  return { docTitle, sections };
}

export interface ChunkPiece {
  section: string;
  text: string;
  chunkIndex: number;
}

export interface ChunkOptions {
  /** 以字元計。中文一個字不等於一個 Token，這裡用字元是為了讓結果容易預測 */
  maxChars: number;
  overlapChars: number;
  /** 把「文件名稱／章節」帶進 Chunk 正文，避免「標題被切掉」這類災難 */
  keepHeading: boolean;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
  maxChars: 320,
  overlapChars: 40,
  keepHeading: true,
};

function splitLongBody(body: string, maxChars: number, overlapChars: number): string[] {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let buffer = '';

  const push = () => {
    if (buffer.trim()) out.push(buffer.trim());
    buffer = '';
  };

  for (const para of paragraphs) {
    if (buffer.length + para.length + 1 <= maxChars) {
      buffer = buffer ? `${buffer}\n${para}` : para;
      continue;
    }
    push();
    if (para.length <= maxChars) {
      buffer = para;
      continue;
    }
    let start = 0;
    while (start < para.length) {
      out.push(para.slice(start, start + maxChars));
      if (start + maxChars >= para.length) break;
      start += Math.max(1, maxChars - overlapChars);
    }
  }
  push();
  return out.length > 0 ? out : [body.trim()];
}

export function chunkSections(
  docTitle: string,
  sections: RawSection[],
  options: ChunkOptions = DEFAULT_CHUNK_OPTIONS,
): ChunkPiece[] {
  const pieces: ChunkPiece[] = [];
  let index = 0;
  for (const section of sections) {
    for (const body of splitLongBody(section.body.trim(), options.maxChars, options.overlapChars)) {
      const heading = options.keepHeading
        ? `文件：${docTitle || '未命名文件'}\n章節：${section.section}\n`
        : '';
      pieces.push({ section: section.section, text: `${heading}${body}`.trim(), chunkIndex: index++ });
    }
  }
  return pieces;
}

/** 沒有標題結構的來源（PDF、Word、純文字）：退回用空行分段 */
export function parsePlainText(text: string, titleHint: string): { docTitle: string; sections: RawSection[] } {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return {
    docTitle: titleHint,
    sections: blocks.map((body, i) => ({ section: `段落 ${i + 1}`, body })),
  };
}

export interface PreparedDoc {
  docTitle: string;
  pieces: ChunkPiece[];
}

export type SourceFormat = 'markdown' | 'text';

export function prepareDocument(
  rawContent: string,
  options: ChunkOptions = DEFAULT_CHUNK_OPTIONS,
  format: SourceFormat = 'markdown',
  titleHint = '',
): PreparedDoc {
  const text = rawContent.replace(/\u0000/g, '').trim();
  const parsed = format === 'markdown' ? parseMarkdown(text) : parsePlainText(text, titleHint);
  const docTitle = parsed.docTitle || titleHint;
  return { docTitle, pieces: chunkSections(docTitle, parsed.sections, options) };
}

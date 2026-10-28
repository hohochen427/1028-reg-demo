import type { SourceFormat } from './chunk';

export interface ParsedUpload {
  text: string;
  format: SourceFormat;
}

/** 依副檔名把上傳檔案轉成純文字；PDF／Word 解析失敗時丟出清楚的錯誤訊息 */
export async function parseUpload(fileName: string, buffer: Buffer): Promise<ParsedUpload> {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';

  if (ext === 'md' || ext === 'markdown') {
    return { text: buffer.toString('utf8'), format: 'markdown' };
  }
  if (ext === 'txt') {
    return { text: buffer.toString('utf8'), format: 'text' };
  }
  if (ext === 'pdf') {
    try {
      const mod = (await import('pdf-parse')) as unknown as {
        default: (b: Buffer) => Promise<{ text: string }>;
      };
      const data = await mod.default(buffer);
      return { text: data.text, format: 'text' };
    } catch (err) {
      throw new Error(`PDF 解析失敗（${fileName}）：${err instanceof Error ? err.message : err}`);
    }
  }
  if (ext === 'docx') {
    try {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer });
      return { text: value, format: 'text' };
    } catch (err) {
      throw new Error(`Word 文件解析失敗（${fileName}）：${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error(`不支援的檔案格式：${fileName}（只接受 .md、.txt、.pdf、.docx）`);
}

/** 檔名轉成安全的 docId：只留英數字、連字號，中文與空白轉成連字號 */
export function slugifyDocId(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  const slug = base
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `doc-${Date.now()}`;
}

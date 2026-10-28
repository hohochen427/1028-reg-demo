import type { Viewer } from './types';

/**
 * 把使用者輸入的群組字串（逗號、頓號、空白、換行分隔）整理成乾淨的陣列：
 * 去頭尾空白、轉小寫、去重。存進資料庫與比對時都用同一套規則，避免 HR 與 hr 對不上。
 */
export function normalizeGroups(input: unknown): string[] {
  const raw = Array.isArray(input) ? input.map(String) : typeof input === 'string' ? input.split(/[,，、;；\s]+/) : [];
  const cleaned = raw.map((g) => g.trim().toLowerCase()).filter((g) => g.length > 0 && g.length <= 40);
  return Array.from(new Set(cleaned));
}

/**
 * Chunk 對這位使用者是否可見。這是 FileStore 的過濾規則，
 * PgStore 在 SQL 的 WHERE 裡用同一套邏輯：
 *   allowed_groups 為空 ∨ 與使用者群組有交集 ∨ 使用者是 admin
 */
export function canView(allowedGroups: string[], viewer: Viewer): boolean {
  if (viewer.role === 'admin') return true;
  if (allowedGroups.length === 0) return true;
  return allowedGroups.some((g) => viewer.groups.includes(g));
}

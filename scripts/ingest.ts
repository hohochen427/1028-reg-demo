import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from './load-env';

loadEnv();

/* eslint-disable no-console */
async function main() {
  const { prepareDocument } = await import('../src/lib/chunk');
  const { embedDocuments } = await import('../src/lib/embedding');
  const { getStore } = await import('../src/lib/store');
  const { embeddingProvider, storeKind } = await import('../src/lib/config');

  const args = process.argv.slice(2);
  const reset = args.includes('--reset');

  const docsDir = path.join(process.cwd(), 'data', 'docs');
  const files = (await fs.readdir(docsDir)).filter((f) => f.endsWith('.md')).sort();

  console.log(`儲存層：${storeKind()}　Embedding：${embeddingProvider()}`);
  console.log(`本次處理 ${files.length} 份文件（${docsDir}）\n`);

  const store = getStore();
  if (reset) {
    await store.reset();
    console.log('已清空既有 Chunk。\n');
  }

  let totalChunks = 0;
  for (const file of files) {
    const filePath = path.join(docsDir, file);
    const raw = await fs.readFile(filePath, 'utf8');
    const prepared = prepareDocument(raw);
    const docId = file.replace(/\.md$/, '');
    const source = prepared.docTitle || docId;

    const texts = prepared.pieces.map((p) => p.text);
    const vectors = await embedDocuments(texts);

    await store.insert(
      prepared.pieces.map((piece, i) => ({
        id: `${docId}#${piece.chunkIndex}`,
        docId,
        text: piece.text,
        embedding: vectors[i],
        source,
        section: piece.section,
        chunkIndex: piece.chunkIndex,
        visibility: 'public' as const,
        // 範例文件所有登入者都看得到
        allowedGroups: [] as string[],
      })),
    );

    totalChunks += prepared.pieces.length;
    console.log(`  ${docId.padEnd(24)} ${source.padEnd(20)} ${String(prepared.pieces.length).padStart(3)} 塊`);
  }

  console.log(`\n建庫完成，共 ${totalChunks} 塊 Chunk，資料庫現有 ${await store.count()} 塊。`);
  console.log('下一步：npm run dev，打開 http://localhost:3000 試問。');
  await store.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

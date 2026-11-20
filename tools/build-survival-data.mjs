import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cardDir = path.join(root, 'knowledge-base', '05_事件卡');
const dossierSource = fs.readFileSync(path.join(root, 'dossier.js'), 'utf8');

function arrayExpression(source, marker) {
  const markerAt = source.indexOf(marker);
  if (markerAt < 0) throw new Error(`找不到数据标记：${marker}`);
  const start = source.indexOf('[', markerAt + marker.length);
  if (start < 0) throw new Error(`找不到数组起点：${marker}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = start; i < source.length; i++) {
    const char = source[i], next = source[i + 1];
    if (lineComment) { if (char === '\n') lineComment = false; continue; }
    if (blockComment) { if (char === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; i++; continue; }
    if (char === '/' && next === '*') { blockComment = true; i++; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '[') depth++;
    if (char === ']' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`数组未闭合：${marker}`);
}

const rows = vm.runInNewContext(`(${arrayExpression(dossierSource, 'const rows=')})`);
const dossierById = new Map(rows.map(row => [row[0], {
  person: row[1], category: row[3], scene: row[4], relation: row[5],
  summary: row[6], boundary: row[9], status: row[11]
}]));

function section(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`^## ${escaped}\\s*\\r?\\n+([\\s\\S]*?)(?=^## |\\s*$)`, 'm'));
  return match?.[1]?.trim() || '';
}

const records = fs.readdirSync(cardDir)
  .filter(name => /^[DE]\d{2}\.md$/.test(name))
  .sort((a, b) => a.localeCompare(b, 'en'))
  .map(name => {
    const markdown = fs.readFileSync(path.join(cardDir, name), 'utf8');
    const front = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
    if (!front) throw new Error(`事件卡缺少JSON元数据：${name}`);
    const metadata = JSON.parse(front[1]);
    const id = metadata.event_id;
    const dossier = dossierById.get(id);
    const isDossier = id.startsWith('D');
    if (isDossier && !dossier) throw new Error(`网站事件数据缺少 ${id}`);
    const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || metadata.theme;
    const category = isDossier ? dossier.category : '暴力事件';
    return {
      id,
      title,
      time: metadata.time,
      people: isDossier ? dossier.person : metadata.people,
      category,
      scene: isDossier ? dossier.scene : 'archive',
      relation: isDossier ? dossier.relation : section(markdown, '责任关系（项目整理）'),
      summary: isDossier ? dossier.summary : section(markdown, '项目概述（非原典）'),
      boundary: isDossier ? dossier.boundary : section(markdown, '解释边界'),
      status: metadata.status,
      violent: category === '暴力事件',
      source: `index.html#event=${encodeURIComponent(id)}`
    };
  });

if (records.length !== 41) throw new Error(`预期41条史料卡，实际读取 ${records.length} 条`);
const output = `/* Generated from knowledge-base/05_事件卡 and dossier.js. Run node tools/build-survival-data.mjs after source-card changes. */\nwindow.SURVIVAL_RECORDS = Object.freeze(${JSON.stringify(records, null, 2)});\n`;
fs.writeFileSync(path.join(root, 'survival-game-data.js'), output, 'utf8');
console.log(`已生成 ${records.length} 条史料索引，供游戏侧栏查阅。`);

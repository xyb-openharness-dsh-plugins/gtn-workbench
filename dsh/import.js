/* 文档导入（MinerU 真实解析 → 候选字段，GTN 口径）。
 *
 * 链路：POST /api/gtn/import（原始文件字节 + ?name=）→ MinerU v4 解析 → full.md
 *      → 本文件抽 hCG 化验单字段 → 写 candidates（status='pending'）→ 前端逐项核对。
 *
 * 四条不可让步（家族契约）：
 * 1. **只抄写不推测**：报告里没有的字段不生成候选；数值只做搬运，单位换算、判定全部不做；
 * 2. **候选不是记录**：解析只写 candidates，不碰 hcg_rows；「核对入档」只改候选状态 +
 *    补一行 documents（入档 = 文件进资料库，数值仍由用户在业务页逐条录入）；
 * 3. **拒收零副作用**：rejected 只改状态，事实层与候选原文都不动；
 * 4. **`<0.5` 这类留原文**：value_text 存字符串照抄，不四舍五入成 0。
 *
 * GTN 的候选形状对齐原型 demo-data.imports.candidates：
 *   { file, fields: { 日期, 数值, 单位, 医院 } } —— fields_json 整体存一份，
 *   同时逐字段拆行进 candidates 便于将来逐项核对；这里按原型的"四字段候选卡"还原。
 */

import { createMineruClient, MineruError } from './mineru.js';

export { MineruError };

/** hCG 化验单字段字典：别名要词边界，避免误命中。 */
export const HCG_DICT = [
  { key: 'date', name: '日期', aliases: ['采血日期', '检验日期', '送检日期', '日期'] },
  { key: 'value', name: '数值', aliases: ['hCG', 'HCG', 'β-hCG', 'β-HCG', '总hCG', '结果', '数值'] },
  { key: 'unit', name: '单位', aliases: ['单位'] },
  { key: 'hospital', name: '医院', aliases: ['医院', '医疗机构', '送检单位'] },
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* 词边界匹配保留给"正文中找医院名"这类宽松场景；表头抽取用精确等值（见下）。 */
export const _aliasHit = aliasHit;
function aliasHit(text, alias) {
  const re = new RegExp(`(?<![A-Za-z0-9β-])${escapeRe(alias)}(?![A-Za-z0-9β-])`, 'i');
  return re.test(text);
}

/** 一行 markdown 表格 → 单元格数组。 */
function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}
const isTableLine = (line) => line.trim().startsWith('|') && line.trim().endsWith('|');
const isSeparator = (line) => /^\|[\s:|-]+\|$/.test(line.trim());

function decodeEntities(text) {
  return String(text)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}

function normalizeHtmlTables(md) {
  if (!/<table/i.test(md)) return md;
  return md.replace(/<table[\s\S]*?<\/table>/gi, (block) => {
    const out = [];
    for (const row of block.match(/<tr[\s\S]*?<\/tr>/gi) || []) {
      const tds = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
      if (tds.length) out.push(`| ${tds.join(' | ')} |`);
    }
    return out.join('\n');
  });
}

const NUM_RE = /^(?:[<>≤≥]\s*)?-?\d+(?:\.\d+)?$/;
function valueOf(cell) {
  const t = String(cell).replace(/\s/g, '');
  if (!t) return null;
  if (!NUM_RE.test(t)) return null;
  return t; // 原文照抄（含 <0.5 这类），不转数字不判定
}

/**
 * 从 markdown 抽 hCG 化验单候选（日期 / 数值 / 单位 / 医院）。
 * @returns {{candidates: Array, skipped: Array}} candidates 每项 {key, name, value, line}
 */
export function extractHcgCandidates(markdown) {
  const md = normalizeHtmlTables(String(markdown ?? ''));
  const found = {};
  const skipped = [];
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    if (!isTableLine(lines[i])) { i += 1; continue; }
    const start = i;
    while (i < lines.length && isTableLine(lines[i])) i += 1;
    const blockLines = lines.slice(start, i).filter((l) => !isSeparator(l));
    if (blockLines.length < 2) continue;
    const header = cells(blockLines[0]);
    for (const line of blockLines.slice(1)) {
      const rowCells = cells(line);
      header.forEach((h, c) => {
        const hit = HCG_DICT.find((d) => !found[d.key] && (h === d.name || d.aliases.includes(h)));
        if (!hit) return;
        const val = valueOf(rowCells[c] ?? '');
        if (!val) { skipped.push({ name: hit.name, cell: rowCells[c] ?? '', reason: '不是单一数值/原文' }); return; }
        found[hit.key] = val;
      });
    }
  }
  /* 标题行附近也可能是"医院：市一医院"这类键值对；只做与原型同口径的表格抽取，不猜。 */
  const candidates = HCG_DICT.filter((d) => found[d.key]).map((d) => ({ key: d.key, name: d.name, value: found[d.key] }));
  return { candidates, skipped };
}

/** 报告日期：文件名或正文里的 YYYY-MM-DD / YYYY年M月D日。取不到就是 null（不猜今天）。 */
export function guessReportDate(text, fallback = null) {
  const m = String(text ?? '').match(/(20\d{2})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
  if (!m) return fallback;
  const [_, y, mo, d] = m;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * 导入服务：把「文件 → MinerU → 候选」串起来，并负责落库（只写候选，不写记录）。
 * db 必须是已 migrate 的库；不传 client 时不联网（单测注入解析函数即可）。
 */
export class ImportService {
  constructor(db, { client = null, extract = extractHcgCandidates } = {}) {
    this.db = db;
    this.client = client;
    this.extract = extract;
  }

  /** 纯解析：不落库，返回 {markdown, candidates, skipped, document}。 */
  async parse(buffer, { filename = 'document.pdf', profileKey = 'lin', reportDate = null } = {}) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new MineruError('BAD_INPUT', '文件是空的');
    if (!this.client) throw new MineruError('NO_TOKEN', '没有可用的 MinerU 客户端（缺 token？）');

    const parsed = await this.client.parse({ bytes: buffer, filename });
    const markdown = parsed.markdown ?? '';
    const { candidates, skipped } = this.extract(markdown);
    const date = guessReportDate(filename) ?? guessReportDate(markdown) ?? reportDate ?? null;
    const fields = {};
    for (const c of candidates) fields[c.name] = c.value;
    if (date) fields['日期'] = fields['日期'] ?? date;
    return {
      markdown,
      candidates,
      skipped,
      document: { profileKey, name: filename, date, type: '化验单', status: '已入档', pages: parsed.pages ?? null },
      fields,
    };
  }

  /** 落库：candidates 一行（fields_json 整体，形状同 demo 候选卡）。同事务，失败整体回滚。 */
  record({ profileKey, document, candidates = [], fields = {} }) {
    const j = (v) => JSON.stringify(v);
    this.db.exec('BEGIN');
    try {
      const f = Object.keys(fields).length ? fields : (() => { const o = {}; for (const c of candidates) o[c.name] = c.value; return o; })();
      const r = this.db.prepare('INSERT INTO candidates (profile_key, doc_id, field_key, value_text, status, reviewed_at, filename, fields_json) VALUES (?,?,?,?,?,?,?,?)')
        .run(profileKey, null, 'hcg_import', null, 'pending', null, document.name, j(f));
      this.db.exec('COMMIT');
      return { candidateId: Number(r.lastInsertRowid), candidates: candidates.length, fields: f };
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch { /* 原始错误优先 */ }
      throw error;
    }
  }

  /** 核对一条候选：accept 只改状态（入档=文件已核对，数值由用户在业务页录入）；reject 零副作用。 */
  review(candidateId, status) {
    if (!['accepted', 'rejected', 'pending'].includes(status)) throw new MineruError('BAD_INPUT', `不认识的候选状态：${status}`);
    const r = this.db.prepare('UPDATE candidates SET status = ?, reviewed_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), candidateId);
    return { changed: r.changes, status };
  }
}

/** 默认客户端：从 MINERU_TOKEN / .secrets/mineru.json 取 token。 */
export function createImportService(db, options = {}) {
  const client = options.client ?? createMineruClient(options);
  return new ImportService(db, { client });
}

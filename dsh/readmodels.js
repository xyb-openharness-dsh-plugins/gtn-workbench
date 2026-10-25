/* 读模型（GTN / 林小葡）：把库里的行还原成 **public/demo-data.js 同一形状**。
 *
 * 契约：`GET /api/gtn/bootstrap` 的 data 必须与原型 demo-data.js（唯一数据源）
 * 逐字段一致——test/store.test.mjs 是 deepStrictEqual。所以这里不做任何"顺手优化"：
 * 字段名、数组层级、null 与缺失的语义都跟着 demo-data.js 走。
 *
 * 硬纪律（家族契约）：
 * 1. 读模型一律 ORDER BY rowid（有 ord 的表按 ord，再按 rowid 稳定）；
 * 2. 显式 NULL：未测/未填就是 null，不落 0、不补空串；
 * 3. 分级/派生值读取时算、不落库：FIGO 总分由 figoTotal() 求和，表内无总分列；
 * 4. 随访锚点 = hcg_rows 上 event_mark='anchor' 那行（0001 口径 B，不设"治愈日期"权威列）；
 * 5. 分类卡只做归口（metric_cats）；数值序列在 hcg_rows / metric_points / weight_rows，页面按二级页签画线。
 */

import { AGENT_PANE } from '../lib/layout.js';

const jp = (s, fallback = null) => {
  if (s === null || s === undefined) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
};
/* node:sqlite 返回 null-prototype 行对象，deepStrictEqual 会因原型不同而失败。统一摊平。 */
const rows = (db, sql, ...args) => db.prepare(sql).all(...args).map((r) => ({ ...r }));

/** FIGO/WHO 2000 八项量规：k 与 opts 是固定评分表（UI 量规，不是档案数据），与 demo-data.js 逐字一致。 */
export const FIGO_RUBRIC = [
  { k: '年龄', opts: { 0: '< 40 岁', 1: '≥ 40 岁' } },
  { k: '前次妊娠类型', opts: { 0: '葡萄胎', 1: '流产', 2: '足月产' } },
  { k: '距前次妊娠时间', opts: { 0: '< 4 个月', 1: '4–6 个月', 2: '7–12 个月', 4: '> 12 个月' } },
  { k: '治疗前血 hCG（IU/L）', opts: { 0: '< 10³', 1: '10³–10⁴', 2: '10⁴–10⁵', 4: '> 10⁵' } },
  { k: '最大肿瘤大小（含子宫）', opts: { 0: '< 3 cm', 1: '3–4 cm', 2: '5 cm', 4: '> 5 cm' } },
  { k: '转移部位', opts: { 0: '肺', 1: '脾、肾', 2: '胃肠道', 4: '肝、脑' } },
  { k: '转移数目', opts: { 0: '0 个', 1: '1–3 个', 2: '4–8 个', 4: '> 8 个' } },
  { k: '前次失败化疗', opts: { 0: '无', 2: '单药', 4: '两药及以上' } },
];

/** FIGO 总分：读取时求和（派生值不落库——标准会升版，落库等于把旧标准写成历史事实）。 */
export function figoTotal(figo) {
  return figo.reduce((s, it) => s + (Number(it.picked) || 0), 0);
}

function metaMap(db) {
  const m = {};
  for (const r of rows(db, 'SELECT key, text FROM demo_meta')) m[r.key] = r.text;
  return m;
}

/* ---------------- hCG：in_use 行为现行点；revision_of 链还原 versions ---------------- */

function readHcg(db, key) {
  const all = rows(db, 'SELECT id, drawn_on, value, unit, hospital, event_mark, in_use, revision_of, ver_at, ver_src FROM hcg_rows WHERE profile_key = ? ORDER BY rowid', key);
  const byBase = new Map();          // baseId -> [base行, ...更正行]（按 rowid 序）
  const plain = [];
  for (const r of all) {
    if (r.revision_of === null) {
      if (r.in_use) plain.push(r);
      else byBase.set(r.id, [r]);
    } else {
      const chain = byBase.get(r.revision_of);
      if (chain) chain.push(r);
    }
  }
  const points = [];
  /* 保持插入顺序：按整表 rowid 扫一遍，遇到 base 或独立行时产出点。 */
  for (const r of all) {
    if (r.revision_of !== null) continue;
    if (byBase.has(r.id)) {
      const chain = byBase.get(r.id);
      const current = chain[chain.length - 1];   // 最后一版是现行值
      points.push({
        d: current.drawn_on,
        v: current.value,
        src: current.hospital,
        event: current.event_mark ?? null,
        versions: chain.map((c) => ({ v: String(c.value), at: c.ver_at ?? null, src: c.ver_src ?? null })),
      });
    } else if (r.in_use) {
      points.push({ d: r.drawn_on, v: r.value, src: r.hospital, event: r.event_mark ?? null });
    }
  }
  const unit = all.length ? all[0].unit : (metaMap(db).hcg_unit ?? 'IU/L');
  return { unit, points };
}

/* ---------------- 疗程卡：fields 从 fields_json 还原；更正链还原 versions ---------------- */

function readCycles(db, key) {
  const all = rows(db, 'SELECT id, cycle_no, regimen, start_on, end_on, hcg_on_day, note, in_use, revision_of, fields_json, ver_field, ver_at, ver_src FROM chemo_cycles WHERE profile_key = ? ORDER BY rowid', key);
  const byBase = new Map();
  for (const r of all) {
    if (r.revision_of === null) byBase.set(r.id, [r]);
    else { const c = byBase.get(r.revision_of); if (c) c.push(r); }
  }
  const out = [];
  for (const r of all) {
    if (r.revision_of !== null) continue;
    const chain = byBase.get(r.id);
    if (chain.length > 1) {
      const current = chain[chain.length - 1];
      out.push({
        n: current.cycle_no,
        regimen: current.regimen,
        start: current.start_on,
        end: current.end_on,
        hcgOnDay: current.hcg_on_day,
        fields: jp(current.fields_json, {}),
        note: current.note,
        versions: chain.map((c) => ({ field: c.ver_field ?? null, v: String(c.end_on), at: c.ver_at ?? null, src: c.ver_src ?? null })),
      });
    } else {
      out.push({
        n: r.cycle_no, regimen: r.regimen, start: r.start_on, end: r.end_on,
        hcgOnDay: r.hcg_on_day, fields: jp(r.fields_json, {}), note: r.note,
        versions: null,
      });
    }
  }
  return out;
}

/* ---------------- 临床研究匹配（0004）：规则 × 评估 → demo-data 的 match 形状 ----------------
 * 三档枚举 tier 只取 satisfied / conflict / undetermined；缺失/other 一律 undetermined；
 * 排序按 trials 的数据来源顺序（ord），不按匹配度；待确认规则（pending=1）单列不进三档。 */

export function readMatch(db) {
  const meta = metaMap(db);
  const asr = db.prepare('SELECT profile_revision, rule_set_version, judgments_json, generated_at FROM match_assessments ORDER BY rowid DESC').get();
  if (!asr) {
    return { profileRevision: null, ruleSetVersion: null, generatedAt: null, footerNote: meta.match_footer_note ?? null, channelsNote: meta.match_channels_note ?? null, entries: [] };
  }
  const jz = jp(asr.judgments_json, {});
  const entries = rows(db, 'SELECT record_id FROM trials ORDER BY ord, rowid')
    .map((t) => {
      const rs = rows(db, 'SELECT id, rule_text, pending FROM match_rules WHERE trial_record_id = ? ORDER BY ord, rowid', t.record_id);
      return {
        recordId: t.record_id,
        rules: rs.filter((r) => !r.pending).map((r) => {
          const j = jz[String(r.id)] ?? {};
          return { text: r.rule_text, tier: j.tier ?? 'undetermined', layer: j.layer ?? null, mine: j.mine ?? null, src: j.src ?? null };  // layer：35 号分层
        }),
        pending: rs.filter((r) => r.pending).map((r) => r.rule_text),
      };
    })
    .filter((e) => e.rules.length > 0 || e.pending.length > 0);
  return {
    profileRevision: asr.profile_revision,
    ruleSetVersion: asr.rule_set_version,
    generatedAt: asr.generated_at,
    footerNote: meta.match_footer_note ?? null,
    channelsNote: meta.match_channels_note ?? null,
    entries,
  };
}

/* ---------------- 多系列指标（0005）：还原 metrics 形状（与 demo-data.js 同形） ----------------
 * 序列按 ord/rowid；点按 rowid（demo 播种即时间序）；in_use=1 且非更正行的点进序列。
 * note：series.note 取该序列第一条非空 point note（报告原文照抄，只作对照展示），无则 null。 */

function readMetrics(db, key) {
  const meta = metaMap(db);
  const seriesRows = rows(db, 'SELECT key, name, unit, group_key, ord, source, in_use FROM metric_series WHERE profile_key = ? ORDER BY group_key, ord, rowid', key);
  if (!seriesRows.length) return { note: meta.metrics_note ?? null, series: [] };
  const pointRows = rows(db, 'SELECT series_key, drawn_on, value, unit, source, note FROM metric_points WHERE profile_key = ? AND in_use = 1 AND revision_of IS NULL ORDER BY rowid', key);
  const bySeries = new Map();
  for (const p of pointRows) {
    if (!bySeries.has(p.series_key)) bySeries.set(p.series_key, []);
    bySeries.get(p.series_key).push({ d: p.drawn_on, v: p.value });
  }
  const notes = new Map();
  for (const p of pointRows) {
    if (p.note && !notes.has(p.series_key)) notes.set(p.series_key, p.note);
  }
  return {
    note: meta.metrics_note ?? null,
    series: seriesRows.map((r) => ({
      key: r.key, name: r.name, unit: r.unit, group: r.group_key,
      ord: r.ord, inUse: !!r.in_use, source: r.source ?? null,
      note: notes.get(r.key) ?? null, points: bySeries.get(r.key) ?? [],
    })),
  };
}

/* ---------------- 档案整体 ---------------- */

function readProfile(db, key) {
  const s = db.prepare('SELECT * FROM subjects WHERE profile_key = ?').get(key);
  if (!s) return null;

  const meta = metaMap(db);
  const hcg = readHcg(db, key);
  const anchor = hcg.points.find((p) => p.event === 'anchor') ?? null;

  const fr = db.prepare('SELECT * FROM figo_rows WHERE profile_key = ? AND in_use = 1 ORDER BY rowid').get(key);
  const figo = fr
    ? FIGO_RUBRIC.map((it, i) => ({ ...it, picked: fr[['s_age', 's_preg_type', 's_interval', 's_hcg', 's_tumor', 's_met_site', 's_met_count', 's_prev_fail'][i]] }))
    : [];

  const pg = db.prepare('SELECT * FROM pregnancy_rows WHERE profile_key = ? AND in_use = 1 ORDER BY rowid').get(key);

  const months = rows(db, 'SELECT month_no, drawn_on, hcg_text, contraception, fertility_plan FROM followup_rows WHERE profile_key = ? AND in_use = 1 ORDER BY month_no, rowid', key)
    .map((r) => ({ n: r.month_no, due: r.drawn_on, hcg: r.hcg_text, contra: r.contraception, fertility: r.fertility_plan }));

  const sources = {};
  for (const r of rows(db, 'SELECT key, label, note FROM guideline_sources ORDER BY rowid')) {
    sources[r.key] = { label: r.label, text: r.note };
  }

  const docs = rows(db, 'SELECT id, kind, filename, imported_at, status FROM documents WHERE profile_key = ? ORDER BY rowid', key)
    .map((r) => ({ id: `D${r.id}`, name: r.filename, date: r.imported_at, type: r.kind, status: r.status }));
  const cands = rows(db, 'SELECT id, filename, fields_json, status FROM candidates WHERE profile_key = ? ORDER BY rowid', key)
    .map((r) => ({ id: `C${r.id}`, file: r.filename, authorized: false, unverified: true, status: r.status, fields: jp(r.fields_json, {}) }));

  return {
    patient: { name: s.name, age: s.age, headline: s.headline },
    pregnancy: pg ? {
      type: pg.preg_type, lmp: pg.lmp, evacuationDate: pg.preg_end_on, hospital: pg.hospital,
      gestWeek: pg.gest_week, uterusSize: pg.uterus_size, bleeding: pg.bleeding,
    } : null,
    figo,
    figoNote: fr ? fr.source_note : null,
    pathology: rows(db, 'SELECT src, text FROM pathology_rows WHERE profile_key = ? AND in_use = 1 ORDER BY ord, rowid', key),
    hcg,
    cycles: readCycles(db, key),
    followup: {
      anchor: anchor ? anchor.d : null,
      anchorLabel: meta.followup_anchor_label ?? null,
      planMonths: Number(meta.followup_plan_months ?? 0),
      months,
    },
    sources,
    questions: rows(db, 'SELECT text FROM question_rows WHERE profile_key = ? AND in_use = 1 ORDER BY rowid', key).map((r) => r.text),
    imports: { docs, candidates: cands },
    nutrition: {
      note: meta.nutrition_note ?? null,
      meals: rows(db, 'SELECT d, meal, intake, ulcer, ulcer_note, folate FROM nutrition_rows WHERE profile_key = ? AND in_use = 1 ORDER BY ord, rowid', key)
        .map((r) => ({ d: r.d, meal: r.meal, intake: r.intake, ulcer: r.ulcer, ulcerNote: r.ulcer_note, folate: r.folate })),
      weight: rows(db, 'SELECT d, value FROM weight_rows WHERE profile_key = ? AND in_use = 1 ORDER BY ord, rowid', key)
        .map((r) => ({ d: r.d, v: r.value })),
      quote: meta.nutrition_quote ?? null,
    },
    mind: {
      moods: rows(db, 'SELECT d, state, text FROM mood_rows WHERE profile_key = ? AND in_use = 1 ORDER BY ord, rowid', key)
        .map((r) => ({ d: r.d, state: r.state, text: r.text })),
      waitDays: rows(db, 'SELECT d, text, cope FROM wait_rows WHERE profile_key = ? AND in_use = 1 ORDER BY ord, rowid', key)
        .map((r) => ({ d: r.d, text: r.text, cope: r.cope })),
      family: rows(db, 'SELECT d, who, text FROM family_rows WHERE profile_key = ? AND in_use = 1 ORDER BY ord, rowid', key)
        .map((r) => ({ d: r.d, who: r.who, text: r.text })),
      resources: [],
      quote: meta.mind_quote ?? null,
    },
    trials: {
      sourceLabel: meta.trials_source_label ?? null,
      disclaimer: meta.trials_disclaimer ?? null,
      items: rows(db, 'SELECT record_id, title, sponsor, status, source, url FROM trials ORDER BY ord, rowid')
        .map((r) => ({ recordId: r.record_id, title: r.title, sponsor: r.sponsor, status: r.status, source: r.source, url: r.url })),
    },
    metricCats: rows(db, 'SELECT key, name, latest, count, note, go, go_label FROM metric_cats ORDER BY ord, rowid')
      .map((r) => ({ key: r.key, name: r.name, latest: r.latest, count: r.count, note: r.note, go: r.go, goLabel: r.go_label })),
    metrics: readMetrics(db, key),
    match: readMatch(db),
    /* settings 只回服务端可定值（目录/解析模式）；cred 状态由 /settings/mineru 单独给，packs 静态。 */
    settings: {
      dir: meta.settings_dir ?? null,
      parseMode: meta.settings_parse_mode ?? 'cloud',
    },
  };
}

export function listSubjects(db) {
  return rows(db, 'SELECT profile_key, name FROM subjects ORDER BY rowid');
}

export function getProfile(db, key) {
  return readProfile(db, key);
}

/** `/api/gtn/trials/match` 的 payload：最近一次评估（三档 + 待确认规则，无百分比无排序）。 */
export function matchAssessment(db) {
  return readMatch(db);
}

/**
 * `/api/gtn/bootstrap` 的 payload。
 * data = 单档案形状（与 demo-data.js 的窗口数据同形）；version/build 由调用方注入（唯一来源 lib/version.js）。
 * @param {object} [opts.workspace] 资料目录路径（独立启动时下发，设置页显示）
 */
export function bootstrap(db, { version, build, workspace = null } = {}) {
  const subject = listSubjects(db)[0] ?? null;
  const data = subject ? readProfile(db, subject.profile_key) : null;
  if (data) data.settings.dir = workspace ?? data.settings.dir;
  return {
    version: version ?? null,
    build: build ?? null,
    data,
    /* 宿主未提供原生会话时这里会是 available:false；开发版自带挂载位演示，所以默认 true。 */
    agent: { available: true, mode: 'dev-mount' },
    layout: { agentPane: AGENT_PANE },
  };
}

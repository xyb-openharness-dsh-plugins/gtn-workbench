/* 演示数据播种（GTN / 林小葡旅程）。
 *
 * **唯一数据源是 public/demo-data.js**（原型四件套之一，check-prototype 也断言它）。
 * 这里在 Node 里读取该文件并求值取出 window.DEMO_DATA，再把同一份数值写进
 * 用户资料目录的库——不在别处再抄一份数字，否则原型与开发版会各说一套
 * （test/store.test.mjs 的 deepStrictEqual parity 断言就是钉这个的）。
 *
 * 幂等：库里已经有 subjects 就整批跳过（开发版启动时可能跑很多次）。
 * 事务：整批在一个事务里，中途失败整体回滚，不留"半个档案"。
 *
 * 映射口径（schema 0001 + 0002）：
 * - hCG 点：hcg_rows（in_use=1 为现行值；带版本链的点拆成 base(in_use=0) + 更正行(revision_of)，
 *   ver_at/ver_src 记"何时改/为什么改"，与 demo-data.js 的 versions 数组一一对应）；
 * - 疗程卡：chemo_cycles（fields 键值区 → fields_json 原文；更正链同 hCG）；
 * - FIGO 8 项：figo_rows 一行（照抄原始分，**总分由读模型求和，不落库**）；
 * - 末次妊娠：pregnancy_rows（0002 展示列 lmp/hospital/gest_week/uterus_size/bleeding）；
 * - 病理/影像摘录：pathology_rows（0002，原文照抄不判读）；
 * - 随访月：followup_rows（hcg_text 存原文串；锚点= hCG 序列里 event_mark='anchor' 那行）；
 * - 出处切换：guideline_sources（nccn / csm / mine）；
 * - 问题清单：question_rows；资料/候选：documents / candidates（id 由库自增，
 *   读模型还原成 'D1'/'C1' 形状）；
 * - planMonths / anchorLabel / meta：demo_meta。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DEMO_DATA_PATH = fileURLToPath(new URL('../public/demo-data.js', import.meta.url));

/** 读取并求值 public/demo-data.js（浏览器脚本：`window.DEMO_DATA = {...}`）。 */
export function loadDemoData(path = DEMO_DATA_PATH) {
  const src = readFileSync(path, 'utf8');
  const win = {};
  new Function('window', `'use strict'\n${src}\n`)(win);
  if (!win.DEMO_DATA || typeof win.DEMO_DATA !== 'object') {
    throw new Error(`public/demo-data.js 没有产出 window.DEMO_DATA：${path}`);
  }
  return win.DEMO_DATA;
}

const j = (v) => (v === undefined ? null : JSON.stringify(v));

/** 把 demo-data（林小葡）写进库。返回写入计数。 */
export function seedDemo(db, input) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('seedDemo 需要一个已打开的数据库');
  const D = input || loadDemoData();

  const already = db.prepare('SELECT COUNT(*) AS n FROM subjects').get().n;
  if (already > 0) return { skipped: true, subjects: 0, hcg: 0, cycles: 0, followup: 0 };

  const counts = { skipped: false, subjects: 0, hcg: 0, cycles: 0, followup: 0 };
  const key = 'lin';

  db.exec('BEGIN');
  try {
    db.prepare(`INSERT INTO subjects
      (profile_key, name, age, meta, headline, stage_text, mindset, dash_keys, path)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(key, D.patient.name, D.patient.age, null, D.patient.headline, null, null, j([]), j([]));
    counts.subjects++;

    /* hCG 序列：普通点一行；带 versions 的点拆 base + 更正行（更正行 in_use=1 承接事件与现行值）。 */
    const insHcg = db.prepare(`INSERT INTO hcg_rows
      (profile_key, drawn_on, value, unit, hospital, event_mark, note, in_use, revision_of, ver_at, ver_src)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
    for (const p of D.hcg.points) {
      if (!p.versions) {
        insHcg.run(key, p.d, p.v, D.hcg.unit, p.src, p.event ?? null, null, 1, null, null, null);
        counts.hcg++;
        continue;
      }
      /* 版本链：versions[i] 对应第 i 版。最后一版是现行值（in_use=1）；旧版 in_use=0。 */
      let prevId = null;
      for (const ver of p.versions) {
        const isCurrent = ver === p.versions[p.versions.length - 1];
        const r = insHcg.run(key, p.d, Number(ver.v), D.hcg.unit, p.src,
          isCurrent ? (p.event ?? null) : null, null,
          isCurrent ? 1 : 0, prevId, ver.at ?? null, ver.src ?? null);
        prevId = Number(r.lastInsertRowid);
        counts.hcg++;
      }
    }

    /* 疗程卡：fields 存 JSON 原文；带 versions 的拆 base + 更正行（旧版结束日期）。 */
    const insCycle = db.prepare(`INSERT INTO chemo_cycles
      (profile_key, cycle_no, regimen, start_on, end_on, hcg_on_day, note, in_use, revision_of,
       fields_json, ver_field, ver_at, ver_src)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const c of D.cycles) {
      const base = c.versions ? c.versions[0] : null;   // 初次录入值（结束日期）
      if (!base) {
        insCycle.run(key, c.n, c.regimen, c.start, c.end, c.hcgOnDay, c.note, 1, null,
          j(c.fields), null, null, null);
        counts.cycles++;
        continue;
      }
      const fix = c.versions[c.versions.length - 1];
      const r1 = insCycle.run(key, c.n, c.regimen, c.start, base.v, c.hcgOnDay, c.note, 0, null,
        j(c.fields), base.field ?? null, base.at ?? null, base.src ?? null);
      insCycle.run(key, c.n, c.regimen, c.start, fix.v, c.hcgOnDay, c.note, 1, Number(r1.lastInsertRowid),
        j(c.fields), fix.field ?? null, fix.at ?? null, fix.src ?? null);
      counts.cycles += 2;
    }

    /* 末次妊娠档案 */
    const pg = D.pregnancy;
    db.prepare(`INSERT INTO pregnancy_rows
      (profile_key, preg_type, preg_end_on, dnc_count, pathology_text, in_use, revision_of,
       lmp, hospital, gest_week, uterus_size, bleeding)
      VALUES (?,?,?,?,?,1,null,?,?,?,?,?)`)
      .run(key, pg.type, pg.evacuationDate, null, null,
        pg.lmp ?? null, pg.hospital ?? null, pg.gestWeek ?? null, pg.uterusSize ?? null, pg.bleeding ?? null);

    /* FIGO 8 项：一行照抄原始分；note 列存 figoNote（出处说明）。 */
    const f = D.figo;
    db.prepare(`INSERT INTO figo_rows
      (profile_key, s_age, s_preg_type, s_interval, s_hcg, s_tumor, s_met_site, s_met_count, s_prev_fail,
       source_note, in_use, revision_of)
      VALUES (?,?,?,?,?,?,?,?,?,?,1,null)`)
      .run(key, f[0].picked, f[1].picked, f[2].picked, f[3].picked, f[4].picked,
        f[5].picked, f[6].picked, f[7].picked, D.figoNote ?? null);

    /* 病理/影像原文摘录 */
    const insPatho = db.prepare(`INSERT INTO pathology_rows (profile_key, src, text, ord, in_use, revision_of)
      VALUES (?,?,?,?,1,null)`);
    D.pathology.forEach((x, i) => insPatho.run(key, x.src, x.text, i));

    /* 随访月记录 */
    const insFollow = db.prepare(`INSERT INTO followup_rows
      (profile_key, month_no, drawn_on, hcg_value, contraception, fertility_plan, source, note,
       in_use, revision_of, hcg_text)
      VALUES (?,?,?,?,?,?,?,NULL,1,null,?)`);
    for (const m of D.followup.months) {
      const num = Number(m.hcg);
      insFollow.run(key, m.n, m.due, Number.isFinite(num) ? num : null, m.contra, m.fertility, null, m.hcg);
      counts.followup++;
    }

    /* 出处切换注册表 */
    const insSource = db.prepare('INSERT INTO guideline_sources (key, label, version, url, note) VALUES (?,?,?,?,?)');
    for (const [k, s] of Object.entries(D.sources)) insSource.run(k, s.label, null, null, s.text);

    /* 复诊问题清单 */
    const insQ = db.prepare('INSERT INTO question_rows (profile_key, text, asked, in_use, revision_of) VALUES (?,?,0,1,null)');
    for (const q of D.questions) insQ.run(key, q);

    /* 资料档案（documents.id 由库自增，读模型还原成 'D1' 形状） */
    const insDoc = db.prepare('INSERT INTO documents (profile_key, kind, filename, imported_at, sha256, status) VALUES (?,?,?,?,?,?)');
    for (const d of D.imports.docs) insDoc.run(key, d.type, d.name, d.date, null, d.status);

    /* 候选（未核对不入事实层） */
    const insCand = db.prepare('INSERT INTO candidates (profile_key, doc_id, field_key, value_text, status, reviewed_at, filename, fields_json) VALUES (?,?,?,?,?,?,?,?)');
    for (const c of D.imports.candidates) {
      insCand.run(key, null, 'hcg_import', null, c.status ?? 'pending', null, c.file, j(c.fields));
    }

    /* 营养支持（0003）：每餐记录 + 体重序列 */
    const insMeal = db.prepare(`INSERT INTO nutrition_rows
      (profile_key, d, meal, intake, ulcer, ulcer_note, folate, ord, in_use, revision_of)
      VALUES (?,?,?,?,?,?,?,?,1,null)`);
    D.nutrition.meals.forEach((m, i) => insMeal.run(key, m.d, m.meal, m.intake, m.ulcer, m.ulcerNote, m.folate, i));
    const insWeight = db.prepare('INSERT INTO weight_rows (profile_key, d, value, ord, in_use, revision_of) VALUES (?,?,?,?,1,null)');
    D.nutrition.weight.forEach((w, i) => insWeight.run(key, w.d, w.v, i));

    /* 心理支持（0003，整页私密仅本机）：情绪 / 等报告日 / 家庭沟通 */
    const insMood = db.prepare('INSERT INTO mood_rows (profile_key, d, state, text, ord, in_use, revision_of) VALUES (?,?,?,?,?,1,null)');
    D.mind.moods.forEach((m, i) => insMood.run(key, m.d, m.state, m.text, i));
    const insWait = db.prepare('INSERT INTO wait_rows (profile_key, d, text, cope, ord, in_use, revision_of) VALUES (?,?,?,?,?,1,null)');
    D.mind.waitDays.forEach((m, i) => insWait.run(key, m.d, m.text, m.cope, i));
    const insFamily = db.prepare('INSERT INTO family_rows (profile_key, d, who, text, ord, in_use, revision_of) VALUES (?,?,?,?,?,1,null)');
    D.mind.family.forEach((m, i) => insFamily.run(key, m.d, m.who, m.text, i));

    /* 临床研究（0003）：登记摘录快照，与 research jsonl 同步（check-prototype 逐条断言） */
    const insTrial = db.prepare('INSERT INTO trials (record_id, title, sponsor, status, source, url, ord) VALUES (?,?,?,?,?,?,?)');
    D.trials.items.forEach((t, i) => insTrial.run(t.recordId, t.title, t.sponsor, t.status, t.source, t.url, i));

    /* 指标分类卡（0003）：归口与入口 */
    const insCat = db.prepare('INSERT INTO metric_cats (key, name, latest, count, note, go, go_label, ord) VALUES (?,?,?,?,?,?,?,?)');
    D.metricCats.forEach((c, i) => insCat.run(c.key, c.name, c.latest, c.count, c.note, c.go, c.goLabel, i));

    /* 多系列指标（0005）：序列定义 + 数据点（数值照抄、单位随行、无 ref 判定列）。
       体重仍在 weight_rows、血 hCG 仍在 hcg_rows，这里只收化验序列，不搬家不复制。 */
    const insSeries = db.prepare(`INSERT INTO metric_series
      (profile_key, key, name, unit, group_key, ord, source, in_use)
      VALUES (?,?,?,?,?,?,?,1)`);
    const insPoint = db.prepare(`INSERT INTO metric_points
      (profile_key, series_key, drawn_on, value, unit, source, note, in_use, revision_of)
      VALUES (?,?,?,?,?,?,?,1,null)`);
    for (const s of (D.metrics ? D.metrics.series : [])) {
      insSeries.run(key, s.key, s.name, s.unit, s.group, s.ord, s.source ?? null);
      for (const p of s.points) insPoint.run(key, s.key, p.d, p.v, s.unit, s.source ?? null, s.note ?? null);
    }

    /* 临床研究匹配（0004）：入排规则 + 一次评估快照。
       field_key/rule_type/condition 不进 demo-data（那是展示形状），这里按规则文本归类；
       judgments 按 match_rules.id 关联，保证"同样档案 + 同样规则版本 = 同样结果"。 */
    const ruleMeta = (text) => {
      if (text.startsWith('年龄')) return { field: 'age', type: 'age_range', cond: { op: '>=', value: 18, unit: '岁' } };
      if (text.includes('健康受试者')) return { field: 'disease_status', type: 'disease_type', cond: { op: 'excludes_active_disease', value: true } };
      if (text.startsWith('排除妊娠期')) return { field: 'pregnancy_gtn_history', type: 'disease_type', cond: { op: 'excludes', value: '妊娠期或滋养细胞疾病' } };
      if (text.includes('病理确诊')) return { field: 'pathology', type: 'pathology_required', cond: { op: 'pathology_confirms', value: '滋养细胞肿瘤' } };
      if (text.includes('复发性')) return { field: 'target_population', type: 'other', cond: { note: '登记原文未结构化，保留原文判无法判定' } };
      if (text.includes('hCG')) return { field: 'pre_treatment_hcg', type: 'lab_threshold', cond: { op: '<', value: 100000, unit: 'IU/L' } };
      if (text.includes('化疗线数')) return { field: 'chemo_lines', type: 'prior_therapy_count', cond: { op: '<=', value: Number((text.match(/≤\s*(\d+)/) || [])[1] ?? 1) } };
      if (text.includes('肝功能')) return { field: 'liver_function', type: 'organ_function', cond: { note: '参考范围基准随试验声明；逐项数值未入档时判无法判定' } };
      if (text.includes('随访')) return { field: 'followup_capacity', type: 'other', cond: { note: 'other 类型规则，保留原文判无法判定' } };
      return { field: 'unknown', type: 'other', cond: { note: '未分类，按无法判定处理' } };
    };
    const insRule = db.prepare(`INSERT INTO match_rules
      (trial_record_id, rule_text, field_key, rule_type, condition_json, pending, ord)
      VALUES (?,?,?,?,?,?,?)`);
    const judgments = {};
    for (const e of D.match.entries) {
      let ord = 0;
      for (const r of e.rules) {
        const meta = ruleMeta(r.text);
        const res = insRule.run(e.recordId, r.text, meta.field, meta.type, j(meta.cond), 0, ord++);
        judgments[String(Number(res.lastInsertRowid))] = { tier: r.tier, layer: r.layer ?? null, mine: r.mine, src: r.src };  // layer：35 号分层（structured/text/broad）
      }
      for (const p of e.pending) {
        const meta = ruleMeta(p);
        insRule.run(e.recordId, p, meta.field, meta.type, j(meta.cond), 1, ord++);
      }
    }
    db.prepare(`INSERT INTO match_assessments
      (profile_key, profile_revision, rule_set_version, judgments_json, generated_at)
      VALUES (?,?,?,?,?)`)
      .run(key, D.match.profileRevision, D.match.ruleSetVersion, j(judgments), D.match.generatedAt);

    /* demo_meta：meta 三件 + 随访计划参数 + 营养/心理/研究页文案 */
    const insMeta = db.prepare('INSERT OR REPLACE INTO demo_meta (key, text) VALUES (?,?)');
    for (const [k, v] of Object.entries(D.meta || {})) insMeta.run(k, String(v));
    insMeta.run('followup_plan_months', String(D.followup.planMonths));
    insMeta.run('followup_anchor_label', D.followup.anchorLabel);
    insMeta.run('nutrition_note', D.nutrition.note);
    insMeta.run('nutrition_quote', D.nutrition.quote);
    insMeta.run('mind_quote', D.mind.quote);
    insMeta.run('trials_source_label', D.trials.sourceLabel);
    insMeta.run('trials_disclaimer', D.trials.disclaimer);
    insMeta.run('match_footer_note', D.match.footerNote);
    insMeta.run('match_channels_note', D.match.channelsNote);
    if (D.metrics) insMeta.run('metrics_note', D.metrics.note);

    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* 回滚失败也要把原始错误抛出去 */ }
    throw new Error(`播种演示数据失败（已回滚）：${error.message}`);
  }
  return counts;
}

/** 库的演示档案是否已播种过。启动流程用它决定要不要 seedDemo。 */
export function hasDemoData(db) {
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM subjects').get().n > 0;
  } catch {
    return false;
  }
}

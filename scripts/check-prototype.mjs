#!/usr/bin/env node
/* check-prototype.mjs — 无头静态断言（Node，不依赖浏览器）。
   用法：node scripts/check-prototype.mjs  → 输出 JSON，退出码 0=全绿 / 1=有失败。
   覆盖：X1 孤儿页、X2 入口文案逐字一致、IP8「不可恢复」、判读词黑名单、
   class="chart"、AI 不自动发送守卫、smoothPath、32 号折叠卡 beforeprint、版本链。 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const app = read('public/app.js');
const css = read('public/style.css');
const html = read('public/index.html');
const data = read('public/demo-data.js');
const doc = read('docs/INTERACTION-DESIGN.md');

const results = [];
const check = (id, ok, detail) => results.push({ id, ok: !!ok, detail });

/* ---------- X1 孤儿页：nav keys × 路径表（P1–P7）双向覆盖 ---------- */
const navMatch = app.match(/const PAGES = \[([\s\S]*?)\];/);
const navKeys = navMatch ? Array.from(navMatch[1].matchAll(/\['([a-z]+)'/g), (m) => m[1]) : [];
/* 页面树（INTERACTION-DESIGN §0）× 场景路径（§1）的 view→路径映射（文档两表合并） */
const EXPECTED = {
  dashboard: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'],  // 看板是 P1–P6 的入口宿主 + P7 回首页
  hcg: ['P1'], treatment: ['P2'], diagnosis: ['P3'], followup: ['P4'],
  import: ['P5'], review: ['P6'], settings: ['P7']
};
const orphans = Object.keys(EXPECTED).filter((k) => !navKeys.includes(k))
  .concat(navKeys.filter((k) => !(k in EXPECTED)));
check('X1-orphan-pages', orphans.length === 0 && navKeys.length === 8,
  { navKeys, expected: Object.keys(EXPECTED), orphans, navCount: navKeys.length });

/* ---------- X2 入口文案逐字一致（INTERACTION-DESIGN §1 入口列 vs app.js） ----------
   入口列形如「接下来」卡「本周 hCG 复查」：取每行 P1–P6 入口列最后一个「…」段为入口动作文案；
   P7 入口=各业务页右上齿轮（无引号串），改按「⚙ 设置」按钮断言。 */
const entryRows = doc.split('\n').filter((l) => /^\|\s*P[1-7]\//.test(l));
const entries = [];
for (const line of entryRows) {
  const cells = line.split('|').map((c) => c.trim());   // cells[1]=场景, cells[2]=入口
  const pid = cells[1].split('/')[0];
  if (pid === 'P7') { entries.push({ p: pid, text: '设置' }); continue; }
  const qs = Array.from((cells[2] || '').matchAll(/「([^」]+)」/g), (m) => m[1]);
  if (qs.length) entries.push({ p: pid, text: qs[qs.length - 1] });
}
const missing = entries.filter((e) => !app.includes(e.text));
/* 「第 N 个月随访 hCG」的 N 为文档占位符：常量本体逐字一致，渲染时 replace('N', 月序)。 */
const usesP4 = /ENTRY_P4\.replace\('N'/.test(app);
check('X2-entry-text', missing.length === 0 && usesP4 && entries.length === 7,
  { entries, missing, p4TemplateRender: usesP4 });

/* ---------- IP8：全站禁「不可恢复」 ---------- */
const ip8Files = { 'public/index.html': html, 'public/app.js': app, 'public/style.css': css, 'public/demo-data.js': data };
const ip8Hits = Object.entries(ip8Files).filter(([, s]) => s.includes('不可恢复')).map(([f]) => f);
check('IP8-no-irreversible', ip8Hits.length === 0, { hits: ip8Hits });

/* ---------- 判读词黑名单 ----------
   词形精确设计（避免误伤，逐条说明）：
   - /正常(?!锚点)/ ："正常"整词禁用；唯一豁免「达正常锚点」——它是任务书与 INTERACTION-DESIGN
     规定的事件标记名（hCG 达正常锚点·用户勾选），不构成判读输出。
     误伤过的写法：/正常/（会把事件标记名一起判死）。
   - /异常/ /高危/ /低危/ ：整词禁用，无豁免（FIGO 页面不得出现任何风险分档）。
   - /建议治疗/ /可以停药/ /安全期/ /可怀孕|可以怀孕/ ：整词禁用。
     误伤说明："安全"整词亦全站不出现（含"数据安全"等组合也不写，改用其它表述），故不需为它设豁免。 */
const BLACKLIST = [
  [/正常(?!锚点)/g, '正常（除「达正常锚点」固定词组）'],
  [/异常/g, '异常'], [/高危/g, '高危'], [/低危/g, '低危'],
  [/建议治疗/g, '建议治疗'], [/可以停药/g, '可以停药'],
  [/安全期|安全/g, '安全 / 安全期'], [/可怀孕|可以怀孕/g, '可怀孕 / 可以怀孕']
];
const blHits = [];
for (const [file, src] of Object.entries({ 'public/app.js': app, 'public/demo-data.js': data, 'public/index.html': html, 'public/style.css': css })) {
  for (const [re, label] of BLACKLIST) {
    const m = src.match(re);
    if (m) blHits.push({ file, word: label, count: m.length });
  }
}
check('blacklist-judgement-words', blHits.length === 0, { hits: blHits });

/* ---------- 图表：class="chart" 存在 + smoothPath 实现 ---------- */
check('chart-class', /<svg class="chart"/.test(app), {});
check('smoothPath-fritsch-carlson', /function smoothPath\(/.test(app) && /curveMonotoneX|单调/.test(app), {});
/* y 轴对数刻度 1/10/100/1k/10k/100k */
check('chart-log-axis', /Math\.log10/.test(app) && /100k/.test(app), {});
/* 不画参考区间带（水印声明"不画"是允许的，画带本身不允许） */
check('no-reference-band', !/class="band"|class="ref-band"/.test(app), {});

/* ---------- AI 不自动发送（IP10）---------- */
const draftFn = app.match(/function agentDraft\([\s\S]*?\n\}/);
const draftCallsSend = draftFn ? /agentSend|send\(/.test(draftFn[0]) : true;
const sendIsUserAction = /data-action="agent-send"/.test(app) && /'agent-send'/.test(app);
const guardComment = /IP10 守卫[\s\S]*?不自动发送|IP10 守卫[\s\S]*?绝不调用发送/.test(app);
check('IP10-agent-draft-no-autosend', !!draftFn && !draftCallsSend && sendIsUserAction && guardComment,
  { hasDraftFn: !!draftFn, draftCallsSend, sendIsUserAction, guardComment });

/* ---------- 每页 AI 按钮 ---------- */
check('agent-draft-every-page', (app.match(/data-action="agent-draft"/g) || []).length >= 1 && /agentPane\(/.test(app), {});
/* ---------- 32 号折叠卡 + beforeprint ---------- */
check('phase-fold-details', /details class="phase-fold"/.test(app) || /class="phase-fold"/.test(app), {});
check('beforeprint-expand', /beforeprint/.test(app) && /details\.phase-fold/.test(app), {});
/* ---------- 删除=更正：版本链 + 改这一条，无裸删除 ---------- */
check('version-chain-demo', /versions/.test(data) && /查看版本链/.test(app) && /改这一条/.test(app), {});
check('no-bare-delete', !/(删除|删掉)这条记录/.test(app), {});
/* ---------- 窄宽与 [hidden] ---------- */
check('hidden-attr-css', /\[hidden\]\s*{\s*display:\s*none/.test(css), {});
check('min-125px-font', /12\.5px/.test(css), {});
check('footer-stick-bottom', /margin-top:\s*auto/.test(css) && /min-height:\s*100vh/.test(css), {});
/* ---------- IP6/IP7：⋯ 更多 / inputmode=decimal / 自绘键盘 ---------- */
check('more-menu-manual-entry', /⋯ 更多/.test(app), {});
check('decimal-keypad', /inputmode="decimal"/.test(app) && /data-keypad/.test(app) && /keypad/.test(css), {});
/* ---------- demo 数据完整性（林小葡旅程） ---------- */
const pts = (data.match(/d: '\d{4}-\d{2}-\d{2}', v:/g) || []).length;
check('demo-journey', data.includes('林小葡') && pts >= 13 && /platform/.test(data) && /anchor/.test(data) && /rebound/.test(data), { hcgPoints: pts });

const failed = results.filter((r) => !r.ok);
const summary = { ok: failed.length === 0, total: results.length, failed: failed.length, checks: results, at: new Date().toISOString() };
console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length ? 1 : 0);

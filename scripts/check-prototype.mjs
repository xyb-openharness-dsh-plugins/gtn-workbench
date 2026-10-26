#!/usr/bin/env node
/* check-prototype.mjs — 无头静态断言（Node，不依赖浏览器）。
   用法：node scripts/check-prototype.mjs  → 输出 JSON，退出码 0=全绿 / 1=有失败。
   覆盖：X1 孤儿页、X2 入口文案逐字一致（P1–P11）、IP8「不可恢复」、判读词黑名单、
   class="chart"、AI 不自动发送守卫、smoothPath、32 号折叠卡 beforeprint、版本链、
   v0.5 检查与指标二级页签（subnav 键 / 多序列图 / 疗程竖条 / 无参考带）。 */
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
/* demo-data 是浏览器脚本：借 dsh/demo.js 的加载器求值，拿到结构化 DEMO_DATA 做数值断言 */
const { loadDemoData } = await import('../dsh/demo.js');
const DEMO = loadDemoData(join(root, 'public/demo-data.js'));

const results = [];
const check = (id, ok, detail) => results.push({ id, ok: !!ok, detail });

/* ---------- X1 孤儿页：nav keys × 路径表（P1–P10）双向覆盖 ---------- */
const navMatch = app.match(/const PAGES = \[([\s\S]*?)\];/);
const navKeys = navMatch ? Array.from(navMatch[1].matchAll(/\['([a-z]+)'/g), (m) => m[1]) : [];
/* 页面树（INTERACTION-DESIGN §0）× 场景路径（§1）的 view→路径映射（文档两表合并） */
const EXPECTED = {
  dashboard: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'],  // 看板是 P1–P10 的入口宿主
  hcg: ['P1'], treatment: ['P2'], diagnosis: ['P3'], followup: ['P4'],
  import: ['P5'], review: ['P6'], settings: ['P7'],
  nutrition: ['P8'], mind: ['P9'], trials: ['P10'],
  oneshow: ['P1']   // 一图秀与 hCG 时间线同源（P1 数值线的全程视图）
};
const orphans = Object.keys(EXPECTED).filter((k) => !navKeys.includes(k))
  .concat(navKeys.filter((k) => !(k in EXPECTED)));
check('X1-orphan-pages', orphans.length === 0 && navKeys.length === 12,
  { navKeys, expected: Object.keys(EXPECTED), orphans, navCount: navKeys.length });

/* ---------- X2 入口文案逐字一致（INTERACTION-DESIGN §1 入口列 vs app.js） ----------
   入口列形如「接下来」卡「本周 hCG 复查」：取每行 P1–P10 入口列最后一个「…」段为入口动作文案；
   P7 入口=各业务页右上齿轮（无引号串），改按「⚙ 设置」按钮断言。 */
const entryRows = doc.split('\n').filter((l) => /^\|\s*P\d+\//.test(l));
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
check('X2-entry-text', missing.length === 0 && usesP4 && entries.length === 11,
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
  [/安全期|安全/g, '安全 / 安全期'], [/可怀孕|可以怀孕/g, '可怀孕 / 可以怀孕'],
  // 评审 P2#8 扩充（2026-10-25 独立评审）：结论性词形同禁。
  [/治愈/g, '治愈'], [/达标/g, '达标（疗效判定口径）'], [/缓解/g, '缓解'],
  [/复发风险/g, '复发风险']
];
const blHits = [];
/* 豁免：demo-data.js 临床研究块内 recordId 行是登记平台原文逐字摘录（trials-jsonl-sync 断言其与
   research/*.jsonl 一致），标题里可能出现「安全性」等词形；原文摘录不改写，黑名单只查工具自写文案。 */
const dataExExcerpt = data.split('\n').filter((l) => !/recordId:/.test(l)).join('\n');
for (const [file, src] of Object.entries({ 'public/app.js': app, 'public/demo-data.js': dataExExcerpt, 'public/index.html': html, 'public/style.css': css })) {
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
check('discuss-every-page', app.includes('data-action="discuss"') && app.includes('aria-label="和 AI 讨论本页内容'), {});
check('discuss-brief-in-dialog', app.includes('data-action="discuss-brief"') && app.includes('和 AI 讨论这个概要'), {});
check('discuss-carries-facts', app.includes('discussFacts()') && app.includes('本页关键信息'), {});
check('disease-brief-entry', app.includes('data-action="disease-brief"') && /aria-label="疾病概要：定义、规范与指南、治疗全景、发展趋势"/.test(app), {});
const readmeMd = read('README.md');
check('disease-brief-four-sections',
  ['定义', '医学资料规范和指南情况', '目前治疗全景概要', '发展趋势'].every(t => app.includes(t))
  && ['定义', '规范与指南', '治疗全景', '发展趋势'].every(t => readmeMd.includes(t))
  && readmeMd.includes('? 疾病概要'), {});
check('demo-journey', data.includes('林小葡') && pts >= 13 && /plateau/.test(data) && /anchor/.test(data) && /rise/.test(data), { hcgPoints: pts });
/* ---------- v0.2.0 新增：3D 指标分类卡 ---------- */
check('flip-3d-card-css', /transform-style:\s*preserve-3d/.test(css) && /rotateY\(180deg\)/.test(css) && /backface-visibility:\s*hidden/.test(css), {});
check('flip-3d-card-js', /data-action="flip"/.test(app) && /aria-pressed/.test(app) && /state\.flipped/.test(app), {});
check('flip-cats-not-in-chart', /分类卡只做归口/.test(app) && (app.match(/metricCatGrid\(\)/g) || []).length >= 2, {});
/* ---------- v0.2.0 新增：临床研究页读 trials jsonl ----------
   demo-data.js 内嵌登记摘录快照必须与 research/gestational-trophoblastic/trials-2026.jsonl 逐条一致（登记号 + 题目）。 */
let trialsLines = [];
try { trialsLines = read('research/gestational-trophoblastic/trials-2026.jsonl').trim().split('\n').map((l) => JSON.parse(l)); } catch { /* 缺文件则记 0 条 */ }
const trialsMatched = trialsLines.filter((r) => {
  const rid = (r.registryNumbers || []).find((x) => x.primary)?.value || '';
  return rid && data.includes(rid) && data.includes(r.title);
});
check('trials-jsonl-sync', trialsLines.length === 6 && trialsMatched.length === 6,
  { jsonl: trialsLines.length, matched: trialsMatched.length });
check('trials-disclaimer', app.includes('登记 ≠ 有效 ≠ 可入组') && data.includes('登记状态，未核实') && app.includes('未核实'), {});
/* ---------- v0.2.0 新增：营养 / 心理 / 一图秀数据 ---------- */
check('nutrition-mind-data',
  (data.match(/d: '\d{4}-\d{2}-\d{2}', meal:/g) || []).length >= 7 &&
  (data.match(/d: '\d{4}-\d{2}-\d{2}', state:/g) || []).length >= 5 &&
  /waitDays/.test(data) && /口腔溃疡/.test(data) && /仅本机/.test(app), {});
check('oneshow-chart', /function oneshowChart/.test(app) && /清宫/.test(app) && /达正常锚点（你勾选）/.test(app), {});
/* ---------- v0.4.0 新增：临床研究三档匹配表达约束（MATCHING-SPEC §4.4） ---------- */
check('match-three-tiers',
  /结构化命中/.test(app) && /文本命中/.test(app) && /宽口径命中/.test(app) && /无法自动匹配/.test(app) && /待确认规则/.test(app)
  && /satisfied/.test(data) && /conflict/.test(data) && /undetermined/.test(data), {});
check('match-summary-line', /粗筛符合度/.test(app) && /符合 \$\{mb\.met\}/.test(app)
  && app.includes('粗筛符合度 = 符合项 ÷ 已对照项，无法自动匹配按 0 计')
  && app.includes('这不是入组资格，也不代表任何效果预期'), {});
check('match-footer-sentence', app.includes('D.match.footerNote') && app.includes('登记状态，未核实')
  && app.includes('登记状态 ≠ 有效 ≠ 可入组')
  && data.includes('分层命中只陈列「条件原文 + 你的记录 + 来源」')
  && data.includes('snapshotDate 2026-10-25'), {});
/* 禁：匹配度百分比 / 高匹配 / 推荐试验（app + demo 自写文案与 HTML；recordId 行豁免同上） */
check('match-no-percent', !/匹配度\s*[%％]|\d+\s*%.*匹配|percent/.test(app) && !/匹配度\s*[%％]/.test(dataExExcerpt) && !/高匹配/.test(app) && !/高匹配/.test(dataExExcerpt), {});
check('match-no-recommend', !/推荐/.test(app) && !/推荐/.test(dataExExcerpt) && !/推荐/.test(html), {});
/* 排序按数据来源顺序：demo 的 match.entries 顺序必须与 trials items 顺序一致（不按匹配度排） */
const matchBlock = (data.split('match: {')[1] || '').split('/* 指标分类')[0];
const matchOrder = [...matchBlock.matchAll(/recordId: '(CTR\d+)'/g)].map((m) => m[1]);
const itemsBlock = (data.split('trials: {')[1] || '').split('/* 临床研究匹配')[0];
const trialsOrderReal = [...itemsBlock.matchAll(/recordId: '(CTR\d+)'/g)].map((m) => m[1]);
check('match-source-order', matchOrder.length === 6 && JSON.stringify(matchOrder) === JSON.stringify(trialsOrderReal), { matchOrder, trialsOrder: trialsOrderReal });
/* 档案完整度 + 缺失→无法判定 不阻断 */
check('match-profile-completeness', /完整度 \$\{fields\.length - missing\.length\}\/\$\{fields\.length\}/.test(app)
  && /缺失不阻断匹配/.test(app) && /无法自动匹配/.test(app), {});
/* 检索双通道 + AI 只起草不代发 + 外部通道如实声明 */
check('trial-subtabs', /trial-sub/.test(app) && app.includes('收藏跟踪') && app.includes('跟踪的是「试验变了什么」') && app.includes('筛条件') && app.includes('两者分开'), {});
check('match-dual-channel', /检索双通道/.test(app) && /自带库检索/.test(app) && /AI 协助匹配/.test(app)
  && /fetch-gtn-trials-2026/.test(app) && /unified-trial-mcp/.test(app) && /终端态如实/.test(app), {});
/* demo 三档都齐：至少 1 条可能冲突 + 至少 2 条无法判定 + 至少 1 条待确认 */
const tierCount = (t) => (data.match(new RegExp(`tier: '${t}'`, 'g')) || []).length;
check('match-demo-tier-mix', tierCount('conflict') >= 1 && tierCount('undetermined') >= 2 && tierCount('satisfied') >= 6
  && /试验期间需采取避孕措施（登记原文未结构化，待确认）/.test(data), { conflict: tierCount('conflict'), undetermined: tierCount('undetermined'), satisfied: tierCount('satisfied') });

/* ---------- v0.5.0 新增：检查与指标二级页签 + 多系列趋势 + 指标管理 ---------- */
/* subnav 键：METRIC_TABS 五键齐全，页签切换 action 存在 */
const tabsMatch = app.match(/const METRIC_TABS = \[([\s\S]*?)\];/);
const tabKeys = tabsMatch ? Array.from(tabsMatch[1].matchAll(/\['([a-z]+)',/g), (m) => m[1]) : [];
check('metric-subnav-tabs',
  JSON.stringify(tabKeys) === JSON.stringify(['bhcg', 'cbc', 'liver', 'weight', 'manage'])
  && /data-action="metric-tab"/.test(app) && /role="tablist"/.test(app),
  { tabKeys });
/* 多序列图：metricSeriesChart 存在（smoothPath 沿用），调用点 ≥ 4（WBC+NEUT / HGB / PLT / ALT+AST / Cr / 体重） */
check('metric-multiseries-chart',
  /function metricSeriesChart\(/.test(app) && (app.match(/metricSeriesChart\(/g) || []).length >= 5
  && /class="chart metric-chart"/.test(app) && /数据点不足|开关显隐/.test(app), {});
/* 疗程竖条：SVG 中性背景条存在（cycle-band），title 写档案事实口径 */
check('metric-cycle-bands', /class="cycle-band"/.test(app) && /档案事实标注，不是判读/.test(app) && /\.cycle-band/.test(css), {});
/* 无参考带红线加强：除既有 no-reference-band 外，「参考区间」只允许出现在"不画/无"语境 */
const refCtx = (src) => (src.match(/.{0,4}参考区间/g) || []).filter((s) => !/不画|无参考区间/.test(s));
check('metric-no-ref-band-context', refCtx(app).length === 0 && refCtx(data).length === 0
  && !/ref_low|ref_high/.test(data), { appHits: refCtx(app).length, dataHits: refCtx(data).length });
/* demo 数据：血常规四序列各 ≥8 点、肝肾功能三序列各 ≥6 点（真实日期、单位恒随行） */
const seriesLen = (k) => { const s = (DEMO.metrics ? DEMO.metrics.series : []).find((x) => x.key === k); return s ? s.points.length : 0; };
check('metric-demo-series',
  ['wbc', 'neut', 'hgb', 'plt'].every((k) => seriesLen(k) >= 8) && ['alt', 'ast', 'cr'].every((k) => seriesLen(k) >= 6)
  && (DEMO.metrics.series.every((s) => !!s.unit) || false),
  { wbc: seriesLen('wbc'), neut: seriesLen('neut'), hgb: seriesLen('hgb'), plt: seriesLen('plt'), alt: seriesLen('alt'), ast: seriesLen('ast'), cr: seriesLen('cr') });
/* 指标管理页：序列清单 + 显隐 + AI 导入候选（不代发）+「⋯ 更多」手工补录（数字键盘）+ 更正=版本链语言 */
check('metric-manage-page',
  /function vMetricManage/.test(app) && /指标序列清单/.test(app) && /data-action="metric-toggle"/.test(app)
  && /metric-ai-cand/.test(app) && /metric-add/.test(app) && /data-keypad/.test(app)
  && /更正=新增版本/.test(app) && /血 hCG \/ 血常规 \/ 肝肾功能 \/ 体重/.test(app), {});

const failed = results.filter((r) => !r.ok);
const summary = { ok: failed.length === 0, total: results.length, failed: failed.length, checks: results, at: new Date().toISOString() };
console.log(JSON.stringify(summary, null, 2));
process.exit(failed.length ? 1 : 0);

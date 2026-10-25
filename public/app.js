'use strict';
/* 小葡宝 GraPal v0.1.0 — GTN 工作台交互原型（M2）。
   数据唯一来源：window.DEMO_DATA（demo-data.js，全部模拟）。
   家族约定：无判读词输出；AI 草稿不自动发送；删除=更正（版本链）；窄宽第一；
   数字输入选择：inputmode="decimal" + 自绘大按钮数字键盘组件（openKeypad），
   不用原生 number 键盘之外的浏览器spinner（视觉与家族键盘组件一致）。 */

const APP_INFO = { version: '0.1.0', build: '2026-10-25' };
const D = window.DEMO_DATA;

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- 导航（IP2：8 个一级页与 P1–P7 双向覆盖） ---------------- */
const PAGES = [
  ['dashboard', '看板'], ['hcg', 'hCG 时间线'], ['treatment', '治疗历程'],
  ['diagnosis', '诊断档案'], ['followup', '随访日历'], ['import', '资料导入'],
  ['review', '复诊准备'], ['settings', '设置']
];
const SUBTITLES = {
  dashboard: '接下来做什么、数值走到哪、疗程记到哪，一页看全。',
  hcg: '对数轴曲线 + 记录列表；事件由你勾选，工具不做判定。',
  treatment: '每疗程一张折叠卡；改过就新增版本，旧值可查。',
  diagnosis: '末次妊娠档案、FIGO 评分自录（照抄原始分）、病理原文摘录。',
  followup: '以你勾选的 hCG 达正常锚点为起点，按月记录。',
  import: '上传报告 → 逐文件授权 → 候选核对 → 入档；拒收零副作用。',
  review: '勾选范围生成一份材料，与档案同源。',
  settings: '资料目录、解析模式与凭据状态、临床参考数据包来源与版本。'
};

/* ---------------- 入口文案（X2：与 INTERACTION-DESIGN §1 逐字一致） ----------------
   「第 N 个月随访 hCG」中的 N 为文档占位符：渲染时替换为实际月序，
   常量本体保持与文档逐字一致，check 脚本按常量源码断言。 */
const ENTRY_P1 = '本周 hCG 复查';
const ENTRY_P2 = '+ 记一个疗程';
const ENTRY_P3 = 'FIGO 评分留个底';
const ENTRY_P4 = '第 N 个月随访 hCG';
const ENTRY_P5 = '导入报告';
const ENTRY_P6 = '复诊前准备';

/* 患者原话占位句（USER-RESEARCH §患者原话占位，改写句 · 0 访谈） */
const QUOTE = {
  s1: '「我想自己看到那条线往下走，心里才踏实。」（改写句 · 0 访谈）',
  s2: '「第几疗、哪天上的药，别等我忘了。」（改写句 · 0 访谈）',
  s3: '「医生说的那些分期数字，我想留个底。」（改写句 · 0 访谈）',
  s4: '「说好查一年，哪个月该查我自己记不清。」（改写句 · 0 访谈）',
  none: '（本功能线暂无患者原话占位 · 0 访谈，M2 访谈后补）'
};

/* ---------------- 状态 ---------------- */
const state = {
  view: 'dashboard',
  drawer: false,
  source: 'mine',            // 出处切换：nccn | csm | mine
  reviewSel: { hcg: true, cycles: true, figo: true, questions: true },
  reviewPreview: false,
  storeDir: D.settings.dir,
  parseMode: D.settings.parseMode,
  candDraft: null,
  keypad: null,              // { input, title }
  pin: null                  // hCG 图选中的点
};
let uidSeq = 0;
const uid = (p) => p + (++uidSeq);
const today = new Date('2026-10-25');   // 原型演示"今天"，与 demo 数据对齐

/* ---------------- 小组件 ---------------- */
const pill = (t, c = '') => `<span class="pill ${c}">${esc(t)}</span>`;
const row = (b, p, right = '') => `<div class="row"><div class="row-main"><div><b>${b}</b>${p ? `<p>${p}</p>` : ''}</div></div>${right ? `<div class="row-side">${right}</div>` : ''}</div>`;
const emptyBox = (h, p) => `<div class="empty"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`;
const quoteLine = (q) => `<p class="quote">${esc(q)}</p>`;
/* 「⋯ 更多」：手工入口统一收进这里（IP6），默认不占页面主视觉。 */
const moreMenu = (items) => `<details class="more"><summary aria-label="更多手工入口">⋯ 更多</summary><div class="more-list">${items.map(i => `<button data-action="${i.action}" data-arg="${esc(i.arg || '')}">${esc(i.label)}</button>`).join('')}</div></details>`;

function pageHead(view) {
  const p = PAGES.find(x => x[0] === view);
  return `<div class="page-head"><div><h1>${esc(p[1])}</h1><p>${esc(SUBTITLES[view])}</p></div></div>`;
}

/* AI 协助条：每个一级页至少一处 gtn:agent-draft 按钮。 */
function agentPane(promptText) {
  return `<section class="card agent-card" aria-label="AI 协助">
    <div class="card-head"><h2>AI 协助</h2>${pill('gtn:agent-draft', 'violet')}</div>
    <p class="muted">点击「让 AI 起草」只会把预写提示词（含本页病情上下文摘要）放进输入框，<b>不会自动发送</b>；内容由你确认后再点「发送」。</p>
    <div class="agent-io">
      <textarea id="agent-input" rows="3" aria-label="AI 对话输入框（草稿需本人确认发送）" placeholder="让 AI 起草后，先读一遍再决定是否发送。"></textarea>
      <div class="agent-btns">
        <button data-action="agent-draft" data-prompt="${esc(promptText)}">让 AI 起草</button>
        <button class="soft" data-action="agent-send">发送</button>
      </div>
    </div>
    <p class="muted small">演示原型未接入真实 AI；「发送」仅提示已发送动作，不产生回复。</p>
  </section>`;
}

/* ---------------- hCG 图（对数轴 + 单调样条 + 用户勾选事件菱形） ---------------- */
const CW = 900, CH = 380, CX0 = 64, CX1 = 860, CY0 = 40, CY1 = 320;
const Y_TICKS = [1, 10, 100, 1000, 10000, 100000];
const Y_LABEL = { 1: '1', 10: '10', 100: '100', 1000: '1k', 10000: '10k', 100000: '100k' };
const LOG_MIN = 0, LOG_MAX = 5;   // log10(1) … log10(100000)

/* 单调保持样条（Fritsch–Carlson，同 d3 curveMonotoneX）：
   每段三次贝塞尔，拐点处切线置平、其余调和加权，保证曲线不越过相邻点的 y 范围。 */
function smoothPath(coords) {
  const n = coords.length;
  if (!n) return '';
  if (n === 1) return `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  const dx = [], sl = [];
  for (let i = 0; i < n - 1; i++) {
    const d = coords[i + 1].x - coords[i].x;
    dx.push(d);
    sl.push(d ? (coords[i + 1].y - coords[i].y) / d : 0);
  }
  const tan = [sl[0]];
  for (let i = 1; i < n - 1; i++) {
    if (sl[i - 1] * sl[i] <= 0) tan.push(0);
    else {
      const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
      tan.push((w1 + w2) / (w1 / sl[i - 1] + w2 / sl[i]));
    }
  }
  tan.push(sl[n - 2]);
  let out = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = coords[i].x + dx[i] / 3, c1y = coords[i].y + tan[i] * dx[i] / 3;
    const c2x = coords[i + 1].x - dx[i] / 3, c2y = coords[i + 1].y - tan[i + 1] * dx[i] / 3;
    out += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${coords[i + 1].x.toFixed(1)} ${coords[i + 1].y.toFixed(1)}`;
  }
  return out;
}

const EVENT_LABEL = { platform: '平台期', rebound: '反弹', anchor: 'hCG 达正常锚点' };

function hcgChart() {
  const pts = D.hcg.points;
  const t0 = Date.parse(pts[0].d), t1 = Date.parse(pts[pts.length - 1].d);
  const xOf = (d) => CX0 + (Date.parse(d) - t0) / Math.max(1, t1 - t0) * (CX1 - CX0);
  const yOf = (v) => CY1 - (Math.log10(Math.max(v, 1)) - LOG_MIN) / (LOG_MAX - LOG_MIN) * (CY1 - CY0);
  const coords = pts.map(p => ({ x: xOf(p.d), y: yOf(p.v) }));
  const grid = Y_TICKS.map(v =>
    `<line class="grid" x1="${CX0}" x2="${CX1}" y1="${yOf(v).toFixed(1)}" y2="${yOf(v).toFixed(1)}"/><text class="tick" x="${CX0 - 8}" y="${(yOf(v) + 3.5).toFixed(1)}" text-anchor="end">${Y_LABEL[v]}</text>`).join('');
  const ticks = pts.map(p => {
    const d = new Date(Date.parse(p.d));
    return `<text class="tick" x="${xOf(p.d).toFixed(1)}" y="${CY1 + 16}" text-anchor="middle">${d.getMonth() + 1}/${d.getDate()}</text>`;
  }).join('');
  const dots = pts.map((p, i) => {
    const isEv = !!p.event;
    return isEv
      ? `<path class="ev" d="M ${coords[i].x.toFixed(1)} ${(coords[i].y - 7).toFixed(1)} l7 7 -7 7 -7 -7 Z" data-action="pin" data-d="${p.d}"><title>${esc(p.d)} · ${p.v} ${D.hcg.unit} · 事件（你勾选）：${EVENT_LABEL[p.event]}</title></path>`
      : `<circle class="pt" cx="${coords[i].x.toFixed(1)}" cy="${coords[i].y.toFixed(1)}" r="4.6" data-action="pin" data-d="${p.d}"><title>${esc(p.d)} · ${p.v} ${D.hcg.unit}</title></circle>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="血 hCG 时间线，纵轴为对数刻度 1 至 10 万 IU/L，事件菱形由用户勾选">
    ${grid}<line class="axis" x1="${CX0}" x2="${CX1}" y1="${CY1}" y2="${CY1}"/>${ticks}
    <path class="line" d="${smoothPath(coords)}" pathLength="1"/>
    ${dots}
    <text class="tick" x="${CX1}" y="${CY1 + 34}" text-anchor="end">纵轴对数刻度（1 / 10 / 100 / 1k / 10k / 100k ${D.hcg.unit}）；不画参考区间带</text>
  </svg>
  <p class="legend"><span class="line-chip"><i class="dot-line"></i>血 hCG（${D.hcg.unit}）</span><span class="line-chip"><i class="diamond"></i>事件标记（平台期 / 反弹 / hCG 达正常锚点）——事件由你勾选，工具不做判定</span></p>
  <p class="pin-tip">${state.pin ? (() => { const p = pts.find(x => x.d === state.pin); return p ? `${esc(p.d)} · <b>${p.v} ${D.hcg.unit}</b> · 来源：${esc(p.src)}${p.event ? ' · 事件（你勾选）：' + esc(EVENT_LABEL[p.event]) : ''}` : ''; })() : '点图上的任意数据点，这里显示那次的数值与来源。'}</p>`;
}

/* ---------------- 页面视图 ---------------- */

function vDashboard() {
  const last = D.hcg.points[D.hcg.points.length - 1];
  const latestMonth = D.followup.months.reduce((a, b) => (b.n > a.n ? b : a), D.followup.months[0]);
  const nextN = latestMonth.n + 1;
  const entryP4 = ENTRY_P4.replace('N', String(nextN));   // 「第 4 个月随访 hCG」
  const lastCycle = D.cycles[D.cycles.length - 1];
  return `${pageHead('dashboard')}
  <section class="hero"><div>
    <span class="eyebrow">演示档案 · ${esc(D.patient.headline)}</span>
    <h1>${esc(D.patient.name)}，接下来看哪一步</h1>
    <p>数值只陈述记录，不给判定；怎么解读问你的主诊医生。</p>
  </div></section>

  <div class="dash-grid">
    <div class="col">
      <div class="card accent"><div class="card-head"><h2>接下来</h2><span class="muted">按医嘱节奏</span></div>
        <div class="rows">
          <button class="task-entry" data-action="go" data-arg="hcg"><b>${esc(ENTRY_P1)}</b><span>录本周血 hCG，曲线即时更新</span></button>
          <button class="task-entry" data-action="go" data-arg="followup"><b>${esc(entryP4)}</b><span>随访第 ${nextN} 个月 · ${esc(D.followup.anchorLabel)}</span></button>
          <button class="task-entry" data-action="go" data-arg="review"><b>${esc(ENTRY_P6)}</b><span>勾选范围生成一份材料</span></button>
        </div>
      </div>
      <div class="card"><div class="card-head"><h2>hCG 概览</h2><span class="muted">最新值，无判定</span></div>
        <div class="rows">
          ${row('最近一次血 hCG', `${esc(last.d)} · <b>${last.v} ${D.hcg.unit}</b> · 来源：${esc(last.src)}`)}
          ${row('记录总数', `${D.hcg.points.length} 次 · 事件标记 ${D.hcg.points.filter(p => p.event).length} 个（均由你勾选）`)}
        </div>
        <div class="actions"><button data-action="go" data-arg="hcg">打开 hCG 时间线 →</button></div>
      </div>
      <div class="card"><div class="card-head"><h2>最近疗程</h2><span class="muted">第 ${lastCycle.n} 疗 · ${esc(lastCycle.regimen)}</span></div>
        <div class="rows">${row(`${esc(lastCycle.start)} → ${esc(lastCycle.end)}`, `当日 hCG ${lastCycle.hcgOnDay} ${D.hcg.unit} · ${esc(lastCycle.note)}`)}</div>
        <div class="actions"><button data-action="go" data-arg="treatment">打开治疗历程 →</button></div>
      </div>
      ${quoteLine(QUOTE.s1)}
    </div>
    <div class="col">
      <div class="card"><div class="card-head"><h2>诊断档案</h2></div>
        <div class="rows">${row('FIGO 评分自录', '8 项照抄原始分，总分自动求和')}</div>
        <div class="actions"><button data-action="go" data-arg="diagnosis">${esc(ENTRY_P3)}</button></div>
      </div>
      <div class="card"><div class="card-head"><h2>资料</h2><span class="muted">${D.imports.docs.length} 份已入档</span></div>
        <div class="rows">${row('待核对候选', `${D.imports.candidates.filter(c => c.status === 'pending').length} 条 · 未核对不入事实层`)}</div>
        <div class="actions"><button data-action="go" data-arg="import">${esc(ENTRY_P5)}</button></div>
      </div>
      <div class="card"><div class="card-head"><h2>最近疗程卡</h2></div>
        <div class="rows">${row('记疗程', '每疗一张折叠卡，收起看概要，展开看详情')}</div>
        <div class="actions"><button data-action="go" data-arg="treatment">${esc(ENTRY_P2)}</button></div>
      </div>
    </div>
  </div>
  ${agentPane('请帮我把本周看板整理成一段给家人看的近况说明：末次妊娠类型、3 个疗程的起止、最近一次血 hCG 数值与日期。只陈述记录，不做任何判定。')}`;
}

function hcgRow(p) {
  const evSel = `<span class="ev-pick" role="group" aria-label="事件标记（三态，由你勾选）">${['platform', 'rebound', 'anchor'].map(k =>
    `<button class="chip${p.event === k ? ' on' : ''}" data-action="mark-event" data-d="${p.d}" data-ev="${k}" aria-pressed="${p.event === k}">${EVENT_LABEL[k]}</button>`).join('')}${p.event ? `<button class="chip soft" data-action="mark-event" data-d="${p.d}" data-ev="">取消</button>` : ''}</span>`;
  return row(
    `${esc(p.d)} · <b>${p.versions ? p.versions[p.versions.length - 1].v : p.v}</b> ${D.hcg.unit}`,
    `来源：${esc(p.src)}${p.versions ? ' · <button class="text-button" data-action="versions" data-d="' + p.d + '">查看版本链</button>' : ''}`,
    evSel
  );
}

function vHcg() {
  return `${pageHead('hcg')}
  <div class="card chart-card"><div class="card-head"><h2>血 hCG 时间线</h2><span class="muted">对数轴 · 无参考区间带</span></div>
    <div class="chart-wrap">${hcgChart()}</div>
  </div>
  <div class="card"><div class="card-head"><h2>记录列表（${D.hcg.points.length}）</h2><div class="head-actions">${moreMenu([{ action: 'add-hcg', label: '手工补一条（数字键盘）' }, { action: 'ai-cand-hcg', label: 'AI：拍照化验单出候选' }])}</div></div>
    <div class="notice">事件标记（平台期 / 反弹 / hCG 达正常锚点）由你按医嘱口径在每行右侧勾选，工具不做判定、不提示结论。</div>
    <div class="rows">${D.hcg.points.slice().reverse().map(hcgRow).join('')}</div>
    ${quoteLine(QUOTE.s1)}
  </div>
  ${candidateCard('hcg')}
  ${agentPane('请帮我把 2026-03-16 以来的血 hCG 记录整理成一张按日期排列的清单（日期 / 数值 / 单位 / 来源），保持原文数值不改写，不要加入任何判定或解释。')}`;
}

function vTreatment() {
  const cards = D.cycles.map(c => `<details class="phase-fold" data-cycle="${c.n}">
    <summary><b>第 ${c.n} 疗</b> · ${esc(c.regimen)} · ${esc(c.start)} → ${esc(c.end)} · 当日 hCG ${c.hcgOnDay} ${D.hcg.unit}<span class="ph-hint">展开细节 ▸</span></summary>
    <div class="phase-detail">
      ${Object.entries(c.fields).slice(0, 6).map(([k, v]) => `<div class="pd-block"><span class="pd-k">${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
      <div class="pd-block"><span class="pd-k">感受备注</span><b>${esc(c.note)}</b></div>
    </div>
    <div class="actions">
      <button data-action="fix-cycle" data-n="${c.n}">改这一条</button>
      ${c.versions ? `<button class="text-button" data-action="cycle-versions" data-n="${c.n}">查看版本链</button>` : ''}
    </div>
  </details>`).join('');
  return `${pageHead('treatment')}
  <div class="notice">每个疗程一张折叠卡：收起只看「第几疗 · 方案 · 起止 · 当日 hCG」，展开看详情与感受备注；打印时自动全部展开。要改就「改这一条」，旧值进版本链，不丢。</div>
  <div class="card"><div class="card-head"><h2>化疗疗程（${D.cycles.length} 疗）</h2><div class="head-actions"><button data-action="add-cycle">${esc(ENTRY_P2)}</button>${moreMenu([{ action: 'ai-cycle', label: 'AI：口述疗程经过出候选' }])}</div></div>
    <div class="folds">${cards}</div>
    ${quoteLine(QUOTE.s2)}
  </div>
  ${candidateCard('cycle')}
  ${agentPane('请帮我口述整理第 3 疗的经过：开始结束日期、方案、当日 hCG、血象复查结果和我说的感受，整理成候选卡片等我逐项核对；不要替我判断疗效。')}`;
}

const figoTotal = () => D.figo.reduce((s, it) => s + (Number(it.picked) || 0), 0);

function sourceSwitch() {
  const cur = state.source;
  const defs = [['nccn', 'NCCN 2.2026'], ['csm', '中国 2021'], ['mine', '我的医嘱']];
  return `<div class="chip-row" role="group" aria-label="随访口径出处切换">${defs.map(([k, l]) =>
    `<button class="chip${cur === k ? ' on' : ''}" data-action="source" data-arg="${k}" aria-pressed="${cur === k}">${l}</button>`).join('')}</div>
    <p class="muted small">${esc(D.sources[cur].label)} · ${esc(D.sources[cur].text)}</p>`;
}

function vDiagnosis() {
  const preg = D.pregnancy;
  return `${pageHead('diagnosis')}
  <div class="card"><div class="card-head"><h2>末次妊娠档案</h2><div class="head-actions">${moreMenu([{ action: 'fix-preg', label: '改这一条（手工 ≤6 字段）' }])}</div></div>
    <div class="rows">
      ${row('妊娠类型', esc(preg.type))}
      ${row('末次月经', esc(preg.lmp))}
      ${row('清宫日期', `${esc(preg.evacuationDate)} · ${esc(preg.hospital)}`)}
      ${row('孕周与子宫', `${esc(preg.gestWeek)} · 子宫${esc(preg.uterusSize.replace('子宫', '').replace('如', '如'))}`)}
      ${row('当时症状', esc(preg.bleeding))}
    </div>
  </div>
  <div class="card"><div class="card-head"><h2>FIGO 评分自录表（8 项）</h2><div class="head-actions"><button data-action="edit-figo">照抄修改评分</button></div></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>项目</th><th>照抄选项</th><th>原始分</th></tr></thead><tbody>
      ${D.figo.map(it => `<tr><td>${esc(it.k)}</td><td>${esc(it.opts[it.picked])}</td><td class="num">${it.picked}</td></tr>`).join('')}
      <tr><td><b>总分（自动求和）</b></td><td>—</td><td class="num"><b>${figoTotal()}</b></td></tr>
    </tbody></table></div>
    <div class="notice">${esc(D.figoNote)} 总分求和不代表分级建议，也不用于任何风险档次的划分。</div>
    ${quoteLine(QUOTE.s3)}
  </div>
  <div class="card"><div class="card-head"><h2>病理与影像原文摘录</h2>${pill('仅摘录 · 不判读', 'grey')}</div>
    <div class="rows">${D.pathology.map(x => row(esc(x.src), esc(x.text))).join('')}</div>
  </div>
  <div class="card"><div class="card-head"><h2>随访口径出处（切换）</h2></div>${sourceSwitch()}</div>
  ${agentPane('请帮我从出院小结的照片里定位 FIGO 评分 8 个项目的原始分（只定位字段与数字，不估算、不求和、不分级），逐项列出候选等我照抄核对。')}`;
}

function vFollowup() {
  const f = D.followup;
  const months = [];
  for (let i = 1; i <= f.planMonths; i++) {
    const rec = f.months.find(m => m.n === i);
    const due = new Date(Date.parse(f.anchor));
    due.setMonth(due.getMonth() + i);
    const dueStr = due.toISOString().slice(0, 10);
    const reached = due.getTime() <= today.getTime();
    months.push({ n: i, due: dueStr, rec, reached });
  }
  const list = months.map(m => {
    if (m.rec) {
      return `<div class="month-row done"><div><b>第 ${m.n} 个月</b><span class="muted">应查 ${esc(m.due)}</span></div>
        <div class="month-fields"><span>hCG：<b>${esc(m.rec.hcg)} ${D.hcg.unit}</b></span><span>避孕方式：${esc(m.rec.contra)}</span><span>再生育计划：${esc(m.rec.fertility)}</span></div>
        <div class="row-side"><button class="text-button" data-action="fix-month" data-n="${m.n}">改这一条</button></div></div>`;
    }
    if (m.reached) {
      return `<div class="month-row due"><div><b>第 ${m.n} 个月</b><span class="muted">应查 ${esc(m.due)} · 已到期待记录</span></div>
        <div class="row-side"><button data-action="add-month" data-n="${m.n}">记录本月</button></div></div>`;
    }
    return `<div class="month-row future" aria-disabled="true"><div><b>第 ${m.n} 个月</b><span class="muted">未到月（约 ${esc(m.due)}）· 置灰不可预填</span></div></div>`;
  }).join('');
  return `${pageHead('followup')}
  <div class="notice">随访月份以 <b>${esc(f.anchorLabel)} · ${esc(f.anchor)}</b> 为锚点生成；未到月置灰，不提供预填。这里不输出任何关于再生育时机的结论，避孕与再生育安排以你的医嘱为准。</div>
  <div class="card"><div class="card-head"><h2>随访月记录（${f.months.length} / ${f.planMonths} 个月）</h2><div class="head-actions">${moreMenu([{ action: 'add-month', label: '手工补录某月（需已到期）' }, { action: 'ai-cand-month', label: 'AI：上传当月化验单出候选' }])}</div></div>
    <div class="months">${list}</div>
    ${quoteLine(QUOTE.s4)}
  </div>
  <div class="card"><div class="card-head"><h2>随访口径出处（切换）</h2></div>${sourceSwitch()}</div>
  ${candidateCard('month')}
  ${agentPane('请帮我整理随访月记录的字段清单（hCG / 避孕方式 / 再生育计划），并提醒我哪些月份已到期还没记录；不要给出任何医学结论。')}`;
}

function vImport() {
  const cands = D.imports.candidates;
  const pend = cands.filter(c => c.status === 'pending');
  return `${pageHead('import')}
  <div class="notice">候选未核对不入事实层；「拒收」零副作用，拒收的条目留在候选区标「未核实」。云端解析需逐文件授权，本演示不读取真实文件。</div>
  <div class="card"><div class="card-head"><h2>资料档案（${D.imports.docs.length}）</h2><div class="head-actions"><button data-action="load-report">${esc(ENTRY_P5)}</button></div></div>
    <div class="rows">${D.imports.docs.map(d => row(esc(d.name), `${esc(d.date)} · ${esc(d.type)}`, pill(d.status, 'green'))).join('')}</div>
  </div>
  <div class="card"><div class="card-head"><h2>AI 候选核对区（${pend.length}）</h2>${pill('未核实', 'yellow')}</div>
    ${pend.length ? pend.map(candItem).join('') : emptyBox('没有待核对候选', '点上方「导入报告」载入一份模拟化验单试试。')}
  </div>
  ${agentPane('请帮我解析这份化验单照片，抽出日期 / 数值 / 单位 / 医院四个字段做候选，逐项等我核对；数值原文照抄，不判定高低。')}`;
}

function candItem(c) {
  return `<div class="cand" data-cand="${c.id}">
    <div class="cand-head"><b>${esc(c.file)}</b>${pill('未核实', 'yellow')}</div>
    <div class="cand-fields">${Object.entries(c.fields).map(([k, v]) => `<span><i>${esc(k)}</i><b>${esc(v)}</b></span>`).join('')}</div>
    <div class="cand-btns">
      <button data-action="cand-ok" data-id="${c.id}">核对入档</button>
      <button class="soft" data-action="cand-fix" data-id="${c.id}">不对，改一下</button>
      <button class="soft warn" data-action="cand-reject" data-id="${c.id}">拒收</button>
    </div>
  </div>`;
}

function candidateCard(kind) {
  const cands = D.imports.candidates.filter(c => c.status === 'pending');
  if (!cands.length) return '';
  const titles = { hcg: 'AI 候选核对区（hCG）', cycle: 'AI 候选核对区（疗程）', month: 'AI 候选核对区（随访月）' };
  return `<div class="card"><div class="card-head"><h2>${titles[kind]}</h2>${pill('未核实', 'yellow')}</div>
    ${cands.map(candItem).join('')}
    <div class="notice">拒收后候选区与事实层都不会变化（零副作用）。</div>
  </div>`;
}

function vReview() {
  const sel = state.reviewSel;
  const items = [
    ['hcg', 'hCG 时间线（15 点）'], ['cycles', '疗程折叠卡（3 疗）'], ['figo', 'FIGO 评分自录表'], ['questions', '问题清单（4 条）']
  ];
  let preview = '';
  if (state.reviewPreview) {
    const last = D.hcg.points[D.hcg.points.length - 1];
    preview = `<div class="card accent"><div class="card-head"><h2>材料预览（与档案同源）</h2>${pill('演示生成', 'violet')}</div>
      ${sel.hcg ? `<h3>血 hCG 时间线</h3><div class="rows">${row('记录范围', `${D.hcg.points[0].d} → ${last.d}，共 ${D.hcg.points.length} 点`)}${row('最近一次', `${last.d} · ${last.v} ${D.hcg.unit}`)}${row('事件标记', D.hcg.points.filter(p => p.event).map(p => `${p.d} ${EVENT_LABEL[p.event]}`).join('；') || '无')}</div>` : ''}
      ${sel.cycles ? `<h3>疗程</h3><div class="rows">${D.cycles.map(c => row(`第 ${c.n} 疗 · ${esc(c.regimen)}`, `${c.start} → ${c.end} · 当日 hCG ${c.hcgOnDay} ${D.hcg.unit}`)).join('')}</div>` : ''}
      ${sel.figo ? `<h3>FIGO 评分自录（照抄）</h3><div class="rows">${D.figo.map(it => row(esc(it.k), `${esc(it.opts[it.picked])} · ${it.picked} 分`)).join('')}${row('总分（自动求和）', String(figoTotal()) + ' · 总分求和不代表分级建议')}</div>` : ''}
      ${sel.questions ? `<h3>问题清单</h3><div class="rows">${D.questions.map((q, i) => row(`${i + 1}. ${esc(q)}`, '')).join('')}</div>` : ''}
    </div>`;
  }
  return `${pageHead('review')}
  <div class="card"><div class="card-head"><h2>勾选范围</h2></div>
    <div class="check-list">${items.map(([k, l]) => `<label class="check-row"><input type="checkbox" data-review="${k}" ${sel[k] ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
    <div class="actions"><button data-action="gen-review">生成预览</button></div>
    <div class="notice">生成失败保留草稿勾选；材料与档案同源（demo 数据唯一来源）。</div>
  </div>
  ${preview || emptyBox('还没有生成预览', '勾选上面要带上的范围，点「生成预览」。')}
  ${agentPane('请帮我把复诊材料压缩成一页口头汇报：先数值（最近 hCG），再疗程，最后三个最想问的问题；只整理我记录的内容，不加建议。')}`;
}

function vSettings() {
  const s = D.settings;
  return `${pageHead('settings')}
  <div class="card"><div class="card-head"><h2>患者资料目录</h2></div>
    <div class="rows">
      ${row('当前目录', `<code>${esc(state.storeDir)}</code>`)}
      ${row('更换目录', '更换不清库：已有档案与记录全部保留，只换存放位置。')}
    </div>
    <div class="actions"><button data-action="pick-dir">更换目录</button></div>
  </div>
  <div class="card"><div class="card-head"><h2>解析模式与凭据状态</h2></div>
    <div class="check-list">
      <label class="check-row"><input type="radio" name="parse-mode" value="cloud" data-action="parse-mode" ${state.parseMode === 'cloud' ? 'checked' : ''}><span>云端解析（逐文件授权）</span></label>
      <label class="check-row"><input type="radio" name="parse-mode" value="local" data-action="parse-mode" ${state.parseMode === 'local' ? 'checked' : ''}><span>本机解析（不上传原件）</span></label>
    </div>
    <div class="rows">${row('凭据来源', esc(s.cred.source))}${row('凭据状态', esc(s.cred.status))}</div>
    <div class="notice">本演示只显示来源与状态，不收集、不保存任何真实密钥。</div>
  </div>
  <div class="card"><div class="card-head"><h2>临床参考数据包</h2></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>来源</th><th>版本</th><th>状态</th></tr></thead><tbody>
      ${s.packs.map(p => `<tr><td>${esc(p.name)}</td><td class="num">${esc(p.ver)}</td><td>${pill(p.status, 'green')}</td></tr>`).join('')}
    </tbody></table></div>
  </div>
  <div class="card"><div class="card-head"><h2>保存 / 取消</h2></div>
    <div class="actions"><button data-action="save-settings">保存</button><button class="soft" data-action="cancel-settings">取消</button></div>
    <div class="notice">取消无副作用：本次未保存的改动会丢弃，回到上次保存值。</div>
  </div>
  ${agentPane('请帮我检查设置页有没有漏项：资料目录、解析模式、凭据状态、三个临床参考数据包来源与版本，各列一行。')}`;
}

const VIEWS = { dashboard: vDashboard, hcg: vHcg, treatment: vTreatment, diagnosis: vDiagnosis, followup: vFollowup, import: vImport, review: vReview, settings: vSettings };

/* ---------------- 渲染 ---------------- */
function render() {
  $('#nav').innerHTML = PAGES.map(([k, l]) =>
    `<button data-action="go" data-arg="${k}" class="${state.view === k ? 'on' : ''}" ${state.view === k ? 'aria-current="page"' : ''}>${esc(l)}</button>`).join('');
  const main = $('#main');
  main.innerHTML = VIEWS[state.view]();
  main.focus({ preventScroll: true });
  $('#breadcrumb').textContent = PAGES.find(p => p[0] === state.view)[1];
  closeDrawer();
  window.scrollTo(0, 0);
}

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._tm); t._tm = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------------- 弹窗表单 ---------------- */
function openDialog(title, bodyHTML, footHTML) {
  $('#dialog-title').textContent = title;
  $('#dialog-body').innerHTML = bodyHTML;
  $('#dialog-foot').innerHTML = footHTML || '<button data-action="close">取消</button>';
  $('#dialog').showModal();
}
const closeDialog = () => { const d = $('#dialog'); if (d.open) d.close(); };

/* 数字键盘组件：inputmode="decimal"（移动端弹系统数字键盘）+ 自绘大按钮键盘（桌面/触屏统一体验）。
   选择说明：自绘键盘便于控字段（只允许数字与小数点），并保证 IP7 全部数字输入同源。 */
function openKeypad(input, unit) {
  state.keypad = { input };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  openDialog('数字键盘',
    `<p class="muted">当前输入：${esc(input.dataset.label || '')}${unit ? '（单位 ' + esc(unit) + '）' : ''}</p>
     <input class="keypad-screen" id="keypad-screen" inputmode="decimal" readonly aria-label="数值">
     <div class="keypad">${keys.map(k => `<button data-action="key" data-k="${k}">${k}</button>`).join('')}</div>`,
    `<button data-action="key-ok">确定</button><button class="soft" data-action="close">取消</button>`);
  $('#keypad-screen').value = input.value || '';
}
function keypadKey(k) {
  const scr = $('#keypad-screen'); if (!scr) return;
  if (k === '⌫') scr.value = scr.value.slice(0, -1);
  else if (k === '.' && scr.value.includes('.')) return;
  else scr.value += k;
}

/* ---------------- 手工表单（≤6 字段） ---------------- */
function formAddHcg() {
  openDialog('手工补一条血 hCG（5 字段）',
    `<div class="form">
      <label>日期<input name="d" value="2026-10-20" placeholder="YYYY-MM-DD"></label>
      <label>数值<input name="v" data-keypad data-label="血 hCG 数值" inputmode="decimal" placeholder="点此用数字键盘"></label>
      <label>单位<input name="u" value="${D.hcg.unit}"></label>
      <label>医院<input name="h" value="市一医院"></label>
      <label>备注（可选）<input name="memo" placeholder="如：外院复查"></label>
    </div>`,
    `<button data-action="save-hcg">保存</button><button class="soft" data-action="close">取消</button>`);
}
function formAddCycle() {
  openDialog('记一个疗程（≤6 字段）',
    `<div class="form">
      <label>方案<input name="regimen" value="甲氨蝶呤（MTX）单药"></label>
      <label>开始日期<input name="start" value="2026-06-22"></label>
      <label>结束日期<input name="end" value="2026-07-12"></label>
      <label>当日 hCG<input name="hcg" data-keypad data-label="当日血 hCG" inputmode="decimal" placeholder="点此用数字键盘"></label>
      <label>感受备注<input name="note" placeholder="一句就行"></label>
    </div>`,
    `<button data-action="save-cycle">保存</button><button class="soft" data-action="close">取消</button>`);
}
function formAddMonth(n) {
  openDialog(`记录第 ${n} 个月随访（3 字段）`,
    `<div class="form">
      <label>血 hCG<input name="hcg" data-keypad data-label="当月血 hCG" inputmode="decimal" placeholder="点此用数字键盘"></label>
      <label>避孕方式<input name="contra" placeholder="如：避孕套（照医嘱填）"></label>
      <label>再生育计划<input name="fertility" placeholder="如：想问医生后续节奏"></label>
    </div>`,
    `<button data-action="save-month" data-n="${n}">保存</button><button class="soft" data-action="close">取消</button>`);
}
function formEditFigo() {
  openDialog('FIGO 评分照抄（8 项，0 / 1 / 2 / 4 分）',
    `<div class="form figo-form">${D.figo.map((it, i) =>
      `<label>${esc(it.k)}<div class="score-row">${Object.entries(it.opts).map(([sc, txt]) =>
        `<button type="button" class="chip${it.picked === Number(sc) ? ' on' : ''}" data-action="figo-pick" data-i="${i}" data-sc="${sc}" aria-pressed="${it.picked === Number(sc)}">${sc} 分 · ${esc(txt)}</button>`).join('')}</div></label>`).join('')}
    </div>
    <div class="notice">照抄报告原始分，不 AI 估算、不输出分级建议。</div>`,
    `<button data-action="save-figo">保存（总分自动求和：${figoTotal()}）</button><button class="soft" data-action="close">取消</button>`);
}
function formVersions(vList, title) {
  openDialog(title || '版本链（更正历史，旧值不丢）',
    `<div class="rows">${vList.map(v => row(`v：${esc(v.v)}`, `${esc(v.at)} · ${esc(v.src)}`)).join('')}</div>`,
    `<button class="soft" data-action="close">关闭</button>`);
}
function formFixCycle(n) {
  const c = D.cycles.find(x => x.n === n);
  openDialog(`改这一条 · 第 ${n} 疗`,
    `<div class="form">
      <label>结束日期<input name="end" value="${c.end}"></label>
      <label>当日 hCG<input name="hcg" data-keypad data-label="当日血 hCG" inputmode="decimal" value="${c.hcgOnDay}"></label>
      <label>改这一条的原因<input name="why" placeholder="如：对照出院小结更正"></label>
    </div>
    <div class="notice">更正=新增版本，旧值进版本链；没有裸删除。</div>`,
    `<button data-action="save-fix-cycle" data-n="${n}">保存更正</button><button class="soft" data-action="close">取消</button>`);
}
function formCandFix(id) {
  const c = D.imports.candidates.find(x => x.id === id);
  openDialog('不对，改一下（候选逐项核对）',
    `<div class="form">${Object.entries(c.fields).map(([k, v]) =>
      `<label>${esc(k)}${k === '数值' ? `<input name="f-${esc(k)}" data-keypad data-label="候选数值" inputmode="decimal" value="${esc(v)}">` : `<input name="f-${esc(k)}" value="${esc(v)}">`}</label>`).join('')}</div>`,
    `<button data-action="cand-fix-save" data-id="${id}">改完核对入档</button><button class="soft" data-action="close">取消</button>`);
}

/* ---------------- AI 草稿（IP10：只填充，不发送） ---------------- */
/* IP10 守卫：gtn:agent-draft 只把提示词放进输入框；本函数绝不调用发送。
   发送只能由用户点击「发送」按钮（data-action="agent-send"）触发。 */
function agentDraft(promptText) {
  const ta = $('#agent-input');
  if (!ta) return;
  ta.value = promptText;
  toast('提示词已放进输入框，不会自动发送；请先阅读确认，再自行点「发送」。');
}
function agentSend() {
  const ta = $('#agent-input');
  if (!ta || !ta.value.trim()) { toast('输入框是空的：先点「让 AI 起草」或自己写一句。'); return; }
  toast('演示原型未接入真实 AI：已表达发送动作，未发送任何内容。');
}

/* ---------------- 事件分发 ---------------- */
const actions = {
  go(el) { state.view = (el && el.dataset && el.dataset.arg) || 'dashboard'; render(); },
  'go-settings'() { actions.go('settings'); },
  'open-store'() { toast(`资料目录：${state.storeDir}（演示路径，更换入口在设置页；更换不清库）`); },
  'agent-draft'(el) { agentDraft(el.dataset.prompt || ''); },
  'agent-send'() { agentSend(); },
  /* hCG */
  'add-hcg'() { formAddHcg(); },
  'save-hcg'() {
    const g = (n) => $(`#dialog-body [name="${n}"]`).value.trim();
    D.hcg.points.push({ d: g('d') || '2026-10-20', v: Number(g('v')) || 0, src: g('h') || '手工录入', event: null });
    closeDialog(); render(); toast('血 hCG 记录 +1，曲线已更新。点顶栏「小葡宝工作台」回到看板。');
  },
  'mark-event'(el) {
    const p = D.hcg.points.find(x => x.d === el.dataset.d);
    if (p) { p.event = el.dataset.ev || null; }
    state.pin = p ? p.d : null; render();
    toast(el.dataset.ev ? `已勾选事件「${EVENT_LABEL[el.dataset.ev]}」——由你勾选，工具不做判定。` : '已取消该点事件勾选。');
  },
  versions(el) {
    const p = D.hcg.points.find(x => x.d === el.dataset.d);
    if (p && p.versions) formVersions(p.versions, `版本链 · ${p.d}`);
  },
  /* 疗程 */
  'add-cycle'() { formAddCycle(); },
  'save-cycle'() {
    const g = (n) => $(`#dialog-body [name="${n}"]`).value.trim();
    D.cycles.push({ n: D.cycles.length + 1, regimen: g('regimen'), start: g('start'), end: g('end'), hcgOnDay: Number(g('hcg')) || 0, fields: { '疗程位置': `第 ${D.cycles.length + 1} 疗`, '录入方式': '手工（数字键盘）' }, note: g('note'), versions: null });
    closeDialog(); render(); toast('疗程折叠卡 +1（默认收起）。');
  },
  'fix-cycle'(el) { formFixCycle(Number(el.dataset.n)); },
  'save-fix-cycle'(el) {
    const c = D.cycles.find(x => x.n === Number(el.dataset.n));
    const g = (n) => $(`#dialog-body [name="${n}"]`).value.trim();
    c.versions = (c.versions || []).concat([{ field: '结束日期 / 当日 hCG', v: `${c.end} / ${c.hcgOnDay}`, at: '2026-10-25', src: g('why') || '改这一条' }]);
    c.end = g('end'); c.hcgOnDay = Number(g('hcg')) || c.hcgOnDay;
    closeDialog(); render(); toast('已更正；旧值进版本链，可在「查看版本链」里回看。');
  },
  'cycle-versions'(el) {
    const c = D.cycles.find(x => x.n === Number(el.dataset.n));
    if (c) formVersions(c.versions, `版本链 · 第 ${c.n} 疗`);
  },
  /* 诊断 */
  'edit-figo'() { formEditFigo(); },
  'figo-pick'(el) {
    const it = D.figo[Number(el.dataset.i)]; it.picked = Number(el.dataset.sc); render(); formEditFigo();
  },
  'save-figo'() { closeDialog(); render(); toast(`评分已照抄保存，总分自动求和：${figoTotal()}（总分求和不代表分级建议）。`); },
  'fix-preg'() { toast('末次妊娠档案为手工更正入口（演示）：旧值进版本链。'); },
  /* 随访 */
  'add-month'(el) { formAddMonth(Number(el.dataset.n) || (D.followup.months.length + 1)); },
  'fix-month'(el) {
    const m = D.followup.months.find(x => x.n === Number(el.dataset.n));
    if (m) formAddMonth(m.n);
  },
  'save-month'(el) {
    const n = Number(el.dataset.n);
    const g = (k) => $(`#dialog-body [name="${k}"]`).value.trim();
    const rec = { n, due: new Date(new Date(D.followup.anchor).setMonth(new Date(D.followup.anchor).getMonth() + n)).toISOString().slice(0, 10), hcg: g('hcg'), contra: g('contra'), fertility: g('fertility') };
    D.followup.months = D.followup.months.filter(m => m.n !== n).concat(rec).sort((a, b) => a.n - b.n);
    closeDialog(); render(); toast(`第 ${n} 个月随访记录 +1，日历已打点。`);
  },
  /* 出处切换 */
  source(el) { state.source = el.dataset.arg; render(); },
  /* 导入 / 候选 */
  'load-report'() {
    D.imports.candidates.push({ id: uid('C'), file: `模拟报告_${(D.imports.candidates.length + 1)}.jpg`, authorized: false, unverified: true, status: 'pending', fields: { '日期': '2026-10-25', '数值': '0.4', '单位': 'IU/L', '医院': '市一医院' } });
    render(); toast('已载入一份模拟报告（逐文件授权演示）：候选出现在核对区，核对前不入事实层。');
  },
  'cand-ok'(el) { const c = D.imports.candidates.find(x => x.id === el.dataset.id); if (c) { c.status = 'accepted'; D.imports.docs.push({ id: uid('D'), name: c.file, date: c.fields['日期'], type: '化验单', status: '已入档' }); } render(); toast('候选已核对入档：档案条目 +1。'); },
  'cand-fix'(el) { formCandFix(el.dataset.id); },
  'cand-fix-save'(el) {
    const c = D.imports.candidates.find(x => x.id === el.dataset.id);
    if (c) { $$('#dialog-body [name]').forEach(inp => { const k = inp.name.replace(/^f-/, ''); if (c.fields[k] !== undefined) c.fields[k] = inp.value.trim(); }); c.status = 'accepted'; }
    closeDialog(); render(); toast('候选按你的更正核对入档（旧值不覆盖，来源留痕）。');
  },
  'cand-reject'(el) {
    const c = D.imports.candidates.find(x => x.id === el.dataset.id);
    if (c) c.status = 'rejected';
    render(); toast('已拒收：候选区与事实层零变化，条目留在候选区标「未核实」。');
  },
  'ai-cand-hcg'() { actions['load-report'](); },
  'ai-cycle'() { toast('AI 口述疗程（演示）：候选卡出现在下方核对区，逐项核对后才入档。'); },
  'ai-cand-month'() { actions['load-report'](); },
  /* 复诊 */
  'gen-review'() { state.reviewPreview = true; render(); toast('材料已生成：与档案同源渲染。'); },
  /* 设置 */
  'pick-dir'() { state.storeDir = '/Users/linxiaopu/Documents/新资料目录（演示）'; render(); toast('目录已更换（演示）：已有记录全部保留，未清库。'); },
  'parse-mode'(el) { state.parseMode = el.value; toast(`解析模式：${el.value === 'cloud' ? '云端解析（逐文件授权）' : '本机解析（不上传原件）'}（需点「保存」生效）。`); },
  'save-settings'() { toast('设置已保存。点顶栏「小葡宝工作台」回到看板。'); },
  'cancel-settings'() { state.storeDir = D.settings.dir; state.parseMode = D.settings.parseMode; render(); toast('已取消：本次改动丢弃，无副作用。'); },
  /* 键盘 */
  key(el) { keypadKey(el.dataset.k); },
  'key-ok'() { if (state.keypad && state.keypad.input) state.keypad.input.value = $('#keypad-screen').value; closeDialog(); },
  close() { closeDialog(); }
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-review]');
  if (el) { state.reviewSel[el.dataset.review] = el.checked; }
});
document.addEventListener('click', (e) => {
  const kp = e.target.closest('[data-keypad]');
  if (kp) openKeypad(kp);
});

/* 抽屉（窄宽：侧栏收成抽屉） */
function openDrawer() { state.drawer = true; $('#sidebar').classList.add('open'); $('#scrim').hidden = false; }
function closeDrawer() { state.drawer = false; $('#sidebar').classList.remove('open'); $('#scrim').hidden = true; }
$('#menu-btn').addEventListener('click', () => (state.drawer ? closeDrawer() : openDrawer()));
$('#scrim').addEventListener('click', closeDrawer);

/* ---------------- 治疗折叠卡：打印展开（32 号实测教训，beforeprint JS，不能只靠 CSS） ---------------- */
(function printExpandFoldouts() {
  let prior = null;
  window.addEventListener('beforeprint', () => {
    const f = Array.from(document.querySelectorAll('details.phase-fold'));
    prior = f.map(d => d.open);
    f.forEach(d => { d.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (!prior) return;
    document.querySelectorAll('details.phase-fold').forEach((d, i) => { d.open = Boolean(prior[i]); });
    prior = null;
  });
})();

/* ---------------- 启动 ---------------- */
render();

'use strict';
/* 小葡宝 GraPal v0.9.0 — GTN 工作台开发版（一图秀 rail 多指标趋势 + 分类卡原位翻转 + 临床研究分层命中 v2）。
   视图与交互保持原型基准（test/ui-parity.test.mjs 逐函数比对，基准 prototypes/v0.5）；开发版只换数据来源：
   先向 `${API_BASE}/api/gtn/bootstrap` 要本机库数据，拿不到才回退 window.DEMO_DATA（离线演示）。
   家族约定：无判读词输出；AI 草稿不自动发送；删除=更正（版本链）；窄宽第一；
   数字输入选择：inputmode="decimal" + 自绘大按钮数字键盘组件（openKeypad），
   不用原生 number 键盘之外的浏览器spinner（视觉与家族键盘组件一致）。 */

const APP_INFO = { version: '0.9.0', build: '2026-10-25' };
let D = window.DEMO_DATA;
let DATA_SOURCE = 'pending';   // 'api' | 'demo'——横幅与设置页据此说明数据来自哪

/* ---------------- 数据层（开发版法定新增，视图函数一概不动） ---------------- */
/* apiBase 定稿契约（v0.1.3）：API_BASE = 挂载前缀（独立启动空串，宿主 /api/gtn 形态），
   页面统一拼 `${API_BASE}/api/gtn/xxx`。守卫只禁交界重复 /api/api（/(^|/)api$/ 正则），
   不许 includes('/api') 一刀切——宿主前缀含 /api 是允许的形态。
   页面在 `<前缀>/api/gtn/ui/` 下，所以把结尾的 /api/gtn/ui 去掉就是挂载前缀。 */
function apiBase() {
  const m = location.pathname.match(/^(.*)\/api\/gtn\/ui(?:\/|$)/);
  return m ? m[1] : '';
}
/** 交界守卫：前缀本身以 /api 结尾时，拼接会产生 /api/api 重复——这是唯一禁止的形态。 */
function apiBaseInvalid(base) {
  return /(^|\/)api$/.test(base);
}

/** 拉本机库数据。返回 {reachable, payload}：reachable=false 才允许回退演示数据。 */
async function loadBootstrap() {
  const url = `${apiBase()}/api/gtn/bootstrap`;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' });
    if (!res.ok) return { reachable: false, payload: null };
    const payload = await res.json();
    return { reachable: true, payload: payload && payload.data ? payload : null };
  } catch { return { reachable: false, payload: null }; }
}

/** 启动期横幅：校验失败 / 掉线时如实说明，禁止裸 throw 白屏。 */
function showBanner(level, html) {
  const b = $('#data-banner');
  if (!b) return;
  b.dataset.level = level;
  b.innerHTML = html;
  b.hidden = false;
}

/** 把 bootstrap 的 data 并进 D：settings 的 cred/packs 是前端侧展示配置，保留回退值。 */
function applyData(payload) {
  const s = { ...(window.DEMO_DATA.settings || {}), ...(payload.data.settings || {}) };
  D = { ...window.DEMO_DATA, ...payload.data, settings: s };
  if (payload.version) {
    APP_INFO.version = payload.version;
    APP_INFO.build = payload.build || APP_INFO.build;
    const v = $('#app-version'), b = $('#app-build');
    if (v) v.textContent = `v${payload.version}`;
    if (b) b.textContent = payload.build || APP_INFO.build;
  }
  /* 面板宽度档位以服务端下发为准（lib/layout.js 唯一来源），页面不留第二份默认值。 */
  const ap = payload.layout && payload.layout.agentPane;
  if (ap) {
    agentDock.min = ap.min ?? agentDock.min;
    agentDock.max = ap.max ?? agentDock.max;
    agentDock.step = ap.ratioStep ?? agentDock.step;
    const sp = $('#agent-splitter');
    if (sp) {
      sp.setAttribute('aria-valuemin', String(Math.round(agentDock.min * 100)));
      sp.setAttribute('aria-valuemax', String(Math.round(agentDock.max * 100)));
    }
    agentWidthApply(ap.default ?? agentDock.width);
  }
}

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- 导航（IP2：12 个一级页与 P1–P10 双向覆盖） ---------------- */
const PAGES = [
  ['dashboard', '看板'], ['hcg', '检查与指标'], ['diagnosis', '诊断档案'],
  ['treatment', '治疗历程'], ['followup', '随访日历'], ['oneshow', '病情一图秀'],
  ['nutrition', '营养支持'], ['mind', '心理支持'], ['trials', '临床研究'],
  ['import', '资料导入'], ['review', '复诊准备'], ['settings', '设置']
];
const SUBTITLES = {
  dashboard: '接下来做什么、数值走到哪、疗程记到哪，一页看全。',
  hcg: '二级页签：血 hCG 对数轴 / 血常规 / 肝肾功能 / 体重 / 指标管理；数值只呈现，工具不做判定。',
  diagnosis: '末次妊娠档案、FIGO 评分自录（照抄原始分）、病理原文摘录。',
  treatment: '每疗程一张折叠卡；改过就新增版本，旧值可查。',
  followup: '以你勾选的 hCG 达正常锚点为起点，按月记录。',
  oneshow: '左栏筛指标（最多 4 条），主区多指标趋势；每条线按自身全部记录范围缩放，不能横向比大小。',
  nutrition: '化疗期每餐记录、口腔溃疡期进食影响、体重序列；叶酸只按医嘱记录。',
  mind: '情绪日记、等报告日的焦虑、家人沟通；私密记录仅本机。',
  trials: '登记摘录 + 入组档案 + 分层命中线索（结构化 / 文本 / 宽口径）+ 无法自动匹配逐条说明；登记状态，未核实。',
  import: '上传报告 → 逐文件授权 → 候选核对 → 入档；拒收零副作用。',
  review: '勾选范围生成一份材料，与档案同源。',
  settings: '资料目录、解析模式与凭据状态、临床参考数据包来源与版本。'
};

/* ---------------- 检查与指标：二级页签（24 号规范：页内 Tab，不把每种化验拆成全局菜单） ---------------- */
const METRIC_TABS = [
  ['bhcg', '血 hCG'], ['cbc', '血常规'], ['liver', '肝肾功能'],
  ['weight', '体重'], ['manage', '指标管理']
];

/* ---------------- 入口文案（X2：与 INTERACTION-DESIGN §1 逐字一致） ----------------
   「第 N 个月随访 hCG」中的 N 为文档占位符：渲染时替换为实际月序，
   常量本体保持与文档逐字一致，check 脚本按常量源码断言。 */
const ENTRY_P1 = '本周 hCG 复查';
const ENTRY_P2 = '+ 记一个疗程';
const ENTRY_P3 = 'FIGO 评分留个底';
const ENTRY_P4 = '第 N 个月随访 hCG';
const ENTRY_P5 = '导入报告';
const ENTRY_P6 = '复诊前准备';
const ENTRY_P8 = '记一餐与口腔情况';
const ENTRY_P9 = '写一条情绪记录';
const ENTRY_P10 = '查登记研究';

/* 患者原话占位句（USER-RESEARCH §患者原话占位，改写句 · 0 访谈） */
const QUOTE = {
  s1: '「我想自己看到那条线往下走，心里才踏实。」（改写句 · 0 访谈）',
  s2: '「第几疗、哪天上的药，别等我忘了。」（改写句 · 0 访谈）',
  s3: '「医生说的那些分期数字，我想留个底。」（改写句 · 0 访谈）',
  s4: '「说好查一年，哪个月该查我自己记不清。」（改写句 · 0 访谈）',
  nutrition: '「化疗那周嘴里破了，吃什么我得记下来问医生。」（改写句 · 0 访谈）',
  mind: '「等结果那两天比化疗还难熬。」（改写句 · 0 访谈）',
  none: '（本功能线暂无患者原话占位 · 0 访谈，M2 访谈后补）'
};

/* ---------------- 状态 ---------------- */
const state = {
  view: 'dashboard',
  metricTab: 'bhcg',          // 检查与指标二级页签：bhcg | cbc | liver | weight | manage
  metricHidden: new Set(),    // 指标序列显隐（series key 集合，仅本机演示态）
  drawer: false,
  source: 'mine',            // 出处切换：nccn | csm | mine
  reviewSel: { hcg: true, cycles: true, figo: true, questions: true },
  reviewPreview: false,
  storeDir: D.settings.dir,
  parseMode: D.settings.parseMode,
  candDraft: null,
  keypad: null,              // { input, title }
  pin: null,                 // hCG 图选中的点
  flipped: new Set(),        // 已翻转的指标分类卡（key 集合）
  trialFavs: new Set(),      // 收藏的试验（saved_trial 心智：trial_key 集合，仅本机演示态）
  trialFilter: 'all',        // 临床研究来源筛选：all | chinadrugtrials
  savedTrials: new Set(),    // 收藏的登记条目（saved_trial 心智：只留线索，record_id 集合，仅本机态）
  /* 一图秀（breast rail 口径）：时间范围 + 指标勾选（≤4）+ 显示开关 + 点选 pin */
  oneshow: {
    range: '6m',             // 默认近 6 月到当前（用户口径）；'3m' | '6m' | '12m' | 'all'
    sel: ['hcg', 'wbc'],     // 序列 key；上限 4，超限 toast（breast rail 口径）
    toggles: { treatment: true, keypoints: true, changes: true },
    pin: null                // 'key|date' 字符串（点选记录点）
  }
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
  /* 疾病概要 ? 入口（用户 2026-10-25 指令）：看板标题行右侧，四要素精炼概要 */
  const briefBtn = view === 'dashboard'
    ? `<button class="brief-btn" data-action="disease-brief" aria-label="疾病概要：定义、规范与指南、治疗全景、发展趋势" title="疾病概要">?</button>` : '';
  /* 「和 AI 讨论」（脚手架标准）：点击拉起 AI 对话栏并携带本页关键信息进输入框（不代发，IP10 守卫同款） */
  const discussBtn = `<button class="discuss-btn" data-action="discuss" aria-label="和 AI 讨论本页内容（拉起对话栏并携带本页关键信息）">和 AI 讨论</button>`;
  return `<div class="page-head"><div><h1>${esc(p[1])}</h1><p>${esc(SUBTITLES[view])}</p></div><div class="head-actions">${briefBtn}${discussBtn}</div></div>`;
}

/* 本页关键信息（「和 AI 讨论」携带的上下文，事实陈述、无判定词）。 */
function discussFacts() {
  const last = D.hcg.points.filter(p => p.in_use !== false).at(-1) ?? D.hcg.points.at(-1);
  const cycles = D.cycles.length;
  const anchor = D.hcg.points.find(p => p.event === 'anchor');
  const fm = D.followup.months.reduce((a, b) => (b.n > a.n ? b : a), D.followup.months[0]);
  const base = `最近血 hCG ${last.v} ${D.hcg.unit}（${last.d}，${last.src}）；疗程记录 ${cycles} 个；${anchor ? `hCG 达正常锚点 ${anchor.d}（用户勾选）；` : ''}随访已记到第 ${fm.n} 个月。`;
  const byView = {
    dashboard: base,
    hcg: base + `hCG 共 ${D.hcg.points.length} 条记录，事件标记 ${D.hcg.points.filter(p => p.event).length} 个（均由你勾选）。`,
    treatment: `疗程 ${cycles} 个：${D.cycles.map(c => `第${c.no}疗 ${c.regimen} ${c.start}~${c.end ?? '进行中'}`).join('；')}。`,
    diagnosis: `末次妊娠：${D.pregnancy.type ?? ''}；FIGO 评分 8 项照抄（总分读取时求和）。`,
    followup: `随访锚点后已记录 ${D.followup.months.length} 个月；节奏出处可切换（NCCN 2.2026 / 中国 2021 / 我的医嘱）。`,
    timeline: base,
    nutrition: `体重最近 ${D.nutrition.weight.at(-1).v} kg（${D.nutrition.weight.at(-1).d}）；餐记录 ${D.nutrition.meals.length} 条。`,
    mind: `情绪日记 ${D.mind.moods.length} 条；等报告日记录 ${D.mind.waitDays.length} 条（私密仅本机）。`,
    trials: `试验库 6 条（登记状态，未核实）；三档匹配结果已生成。`,
    import: `已入档 ${D.imports?.docs?.length ?? 0} 份；候选未核对不入事实层。`,
    review: `复诊材料与档案同源（唯一数据源）。`,
    settings: `资料目录/解析模式/临床参考数据包来源与版本。`,
  };
  return byView[state.view] ?? base;
}

/* 疾病概要（来源 docs/CLINICAL-DATA.md，只做整理性概要，不构成诊断或治疗建议）。 */
const DISEASE_BRIEF = {
  def: '妊娠滋养细胞肿瘤（GTN）是一组源自妊娠滋养细胞的疾病，主要包括侵蚀性葡萄胎、绒毛膜癌与胎盘部位滋养细胞肿瘤等，多继发于葡萄胎妊娠，好发于育龄女性；血 hCG 是贯穿诊断、疗效与随访的核心监测指标。',
  guides: [
    ['NCCN Gestational Trophoblastic Neoplasia', '2.2026（当前版；3.2025 已被取代）'],
    ['FIGO/WHO 2000 解剖学分期与预后评分', 'Ⅰ–Ⅳ 期；8 项评分各 0/1/2/4 分'],
    ['中华医学会《妊娠滋养细胞疾病诊断与治疗指南》', '2021 年版（第四版）'],
    ['随访与避孕口径', 'NCCN / 中国 / EOTTD 不一致——工作台内做出处切换 + 我的医嘱自录'],
    ['hCG 检测溯源', '行业标准 YY/T 1192-2011；"WS/T 679"未核实'],
    ['药品信息', 'NMPA 药品查询官方入口（甲氨蝶呤等具体品种逐条核实）'],
  ],
  treat: '以化疗为主要治疗（单药与联合方案的取舍由 FIGO 评分与主管医生决定，工作台不载剂量）；hCG 序列是疗效与随访的核心线索；hCG 达正常锚点（用户勾选口径）后进入按月随访期，含避孕方式与再生育规划。具体方案与判断以你的主诊医生为准。',
  trend: '指南持续迭代（本病种 NCCN 已从 3.2025 更新至 2.2026）；免疫治疗等新方向仅见于研究文献线索，本工作台不载疗效信息（未核实）；随访节奏多源并存、尚未统一。',
};
function diseaseBriefDialog() {
  openDialog('GTN 疾病概要', `
    <div class="brief-sec"><h3>定义</h3><p>${esc(DISEASE_BRIEF.def)}</p></div>
    <div class="brief-sec"><h3>医学资料规范和指南情况</h3>
      <table class="brief-table"><thead><tr><th>来源</th><th>版本 / 口径</th></tr></thead><tbody>
      ${DISEASE_BRIEF.guides.map(g => `<tr><td>${esc(g[0])}</td><td>${esc(g[1])}</td></tr>`).join('')}
      </tbody></table></div>
    <div class="brief-sec"><h3>目前治疗全景概要</h3><p>${esc(DISEASE_BRIEF.treat)}</p></div>
    <div class="brief-sec"><h3>发展趋势</h3><p>${esc(DISEASE_BRIEF.trend)}</p></div>
    <p class="muted">以上为公开资料的整理性概要，不构成诊断或治疗建议；版本与出处详见设置页与 docs/CLINICAL-DATA.md。</p>`,
    '<button class="soft" data-action="close">关闭</button><button data-action="discuss-brief">和 AI 讨论这个概要</button>');
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

/* ---------------- 指标分类 3D 翻转卡（看板 + hCG 时间线，v0.8 固定尺寸原位翻转） ----------------
   写法照乳腺癌 / NF 基准（.mcard / sparkPts）：perspective 容器 + preserve-3d 内层 + rotateY(180deg) 翻面，
   backface-visibility:hidden 双面；按钮原生 Enter/Space 触发 click，键盘可达；aria-pressed 同步翻转态。
   正面：分类色点 + 当前值 + 单位 + 较前次箭头（↑↓→ + 差值 / 首次记录）+ 记录数；
   背面：代表序列 sparkline（两端值标注 + 两端日期行）+ 脚注「仅回顾已记录值」；
   单点序列背面写「再记录一次后显示趋势」；无序列分类（影像随访）背面说明「无序列」。
   分类卡只做归口：代表序列只挑一条画 spark，完整多序列趋势在「检查与指标」各二级页签。 */
const CAT_COLOR = { hcg: '#7b5ea7', cbc: '#3f7f5e', liver: '#b06a2c', imaging: '#5a6acf' };
function catColor(key) { return CAT_COLOR[key] || 'var(--brand)'; }
/** 分类卡的代表序列（正面当前值 / 背面 spark 都用它；影像类返回 null=无序列）。 */
function catRepSeries(c) {
  if (c.key === 'hcg') return { name: '血 hCG', unit: D.hcg.unit, points: D.hcg.points, source: '市一医院' };
  if (c.key === 'cbc') { const s = seriesByGroup('cbc').find((x) => x.key === 'wbc'); return s ? { name: s.name, unit: s.unit, points: s.points, source: s.source } : null; }
  if (c.key === 'liver') { const s = seriesByGroup('liver').find((x) => x.key === 'alt'); return s ? { name: s.name, unit: s.unit, points: s.points, source: s.source } : null; }
  return null;   // imaging 等无序列分类
}
/** 卡背面 sparkline：两端值标注（NF sparkPts 口径，smoothPath 沿用）。 */
function sparkPts(pts, color) {
  const w = 200, h = 56, pad = 10;
  const vals = pts.map((p) => p.v);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || Math.max(Math.abs(hi) * 0.08, 1);
  const coords = pts.map((p, i) => ({ x: pad + i * (w - pad * 2) / Math.max(pts.length - 1, 1), y: h - 14 - (p.v - lo) / span * (h - 26) }));
  const first = coords[0], last = coords[coords.length - 1];
  return `<svg class="chart spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="代表序列最近 ${pts.length} 次记录折线，两端标注数值">
    <path class="line" d="${smoothPath(coords)}" pathLength="1" style="stroke:${color}"/>
    ${coords.map((cm, i) => `<circle class="pt" cx="${cm.x.toFixed(1)}" cy="${cm.y.toFixed(1)}" r="${i === 0 || i === coords.length - 1 ? 3.2 : 2.2}" fill="${color}"/>`).join('')}
    <text x="${Math.max(first.x, 16).toFixed(1)}" y="${Math.max(first.y - 7, 10).toFixed(1)}" text-anchor="middle" fill="${color}">${pts[0].v}</text>
    <text x="${Math.min(last.x, w - 16).toFixed(1)}" y="${Math.max(last.y - 7, 10).toFixed(1)}" text-anchor="middle" fill="${color}">${pts[pts.length - 1].v}</text>
  </svg>`;
}
function metricCatCard(c) {
  const flipped = state.flipped.has(c.key);
  const color = catColor(c.key);
  const rep = catRepSeries(c);
  const pts = rep ? rep.points : [];
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  /* 较前次箭头：↑ 升 / ↓ 降 / → 持平（只陈述差值，不写高低好坏）；单点=首次记录 */
  const delta = prev
    ? `较前次 ${last.v > prev.v ? '↑' : last.v < prev.v ? '↓' : '→'} <em>${Math.abs(last.v - prev.v)}</em> ${esc(rep.unit)}`
    : pts.length === 1 ? '首次记录' : '';
  let back;
  if (pts.length > 1) {
    back = `<span class="name">${esc(c.name)} · ${esc(rep.name)}（代表序列）</span>
      ${sparkPts(pts, color)}
      <span class="spark-dates"><span>${esc(pts[0].d)}</span><span>${esc(last.d)}</span></span>
      <span class="count">共 ${pts.length} 次 · 完整多序列在「检查与指标」对应页签</span>
      <span class="mfoot">仅回顾已记录值 · 点按 / 回车返回</span>`;
  } else if (pts.length === 1) {
    back = `<span class="name">${esc(c.name)} · ${esc(rep.name)}</span>
      <span class="note">只有 1 次记录，暂不连线。<br>再记录一次后显示趋势。</span>
      <span class="mfoot">仅回顾已记录值 · 点按 / 回车返回</span>`;
  } else {
    back = `<span class="name">${esc(c.name)} · 无序列</span>
      <span class="note">${esc(c.note)}</span>
      <span class="count">影像 / 病理是报告摘录，不是数值序列——本分类无序列可画，原文在诊断档案。</span>
      <span class="mfoot">点按 / 回车返回</span>`;
  }
  return `<button class="mcard" data-action="flip" data-key="${c.key}" aria-pressed="${flipped}" aria-label="指标分类：${esc(c.name)}，${rep && last ? `当前 ${last.v} ${rep.unit}，` : ''}已记录 ${pts.length || c.count} 次；点按或回车翻到背面看趋势与说明">
    <span class="mcard-inner">
      <span class="mface front" aria-hidden="true">
        <span class="cat"><i style="background:${color}"></i>${esc(c.name)}</span>
        <span class="name">${rep ? esc(rep.name) : '报告摘录（无数值序列）'}</span>
        ${rep && last ? `<span class="val">${last.v}<small> ${esc(rep.unit)}</small></span><span class="delta">${delta}</span>` : `<span class="val">${esc(c.latest)}</span><span class="delta">无数值序列</span>`}
        <span class="rec">已记录 ${pts.length || c.count} 次${rep && last ? ` · ${esc(last.d)}` : ''}</span>
        <span class="meta"><span>点按 / 回车翻转</span><span class="hint">↻</span></span>
      </span>
      <span class="mface back" aria-hidden="true">
        ${back}
      </span>
    </span>
  </button>`;
}
function metricCatGrid() {
  return `<section class="card"><div class="card-head"><h2>指标分类（点卡片原位翻转）</h2><span class="muted">四类 · 正面看当前值与较前次，背面看趋势两端值</span></div>
    <div class="mgrid">${D.metricCats.map(metricCatCard).join('')}</div>
    <p class="muted small">分类卡只做归口（血常规以白细胞、肝肾功能以 ALT 为代表序列）；完整多序列趋势在「检查与指标」各二级页签。</p>
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

const EVENT_LABEL = { plateau: '平台期', rise: '反弹', anchor: 'hCG 达正常锚点' };

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
  /* 最近记录流：跨页混排的最新 6 条事实层记录（数值只陈述） */
  const feed = [
    ...D.hcg.points.slice(-4).map(p => ({ d: p.d, t: '血 hCG', s: `${p.v} ${D.hcg.unit} · ${p.src}${p.event ? ' · 事件（你勾选）：' + EVENT_LABEL[p.event] : ''}`, go: 'hcg' })),
    { d: D.mind.moods[D.mind.moods.length - 1].d, t: '情绪日记', s: '一条私密记录 · 仅本机', go: 'mind' },
    { d: D.nutrition.weight[D.nutrition.weight.length - 1].d, t: '体重', s: `${D.nutrition.weight[D.nutrition.weight.length - 1].v} kg · 手工记录`, go: 'nutrition' }
  ].sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 6);
  return `${pageHead('dashboard')}
  <section class="hero"><div>
    <span class="eyebrow">演示档案 · ${esc(D.patient.headline)}</span>
    <h1>${esc(D.patient.name)}，接下来看哪一步</h1>
    <p>数值只陈述记录，不给判定；怎么解读问你的主诊医生。</p>
  </div></section>

  ${metricCatGrid()}
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
      <div class="card"><div class="card-head"><h2>最近记录流</h2><span class="muted">跨页混排 · 最新 ${feed.length} 条</span></div>
        <div class="rows">${feed.map(f => row(`${esc(f.d)} · ${esc(f.t)}`, esc(f.s), `<button class="text-button" data-action="go" data-arg="${f.go}">去看</button>`)).join('')}</div>
      </div>
      <div class="card"><div class="card-head"><h2>支持线</h2><span class="muted">营养 / 心理 / 研究</span></div>
        <div class="rows">
          ${row('营养支持', `每餐记录 ${D.nutrition.meals.length} 条 · 体重 ${D.nutrition.weight.length} 点`)}
          ${row('心理支持', `情绪 ${D.mind.moods.length} 条 · 等报告日 ${D.mind.waitDays.length} 条 · 私密仅本机`)}
          ${row('临床研究', `登记摘录 ${D.trials.items.length} 条 · 登记状态，未核实`)}
        </div>
        <div class="actions"><button data-action="go" data-arg="nutrition">${esc(ENTRY_P8)}</button><button class="soft" data-action="go" data-arg="mind">${esc(ENTRY_P9)}</button><button class="soft" data-action="go" data-arg="trials">${esc(ENTRY_P10)}</button></div>
      </div>
    </div>
  </div>
  ${agentPane('请帮我把本周看板整理成一段给家人看的近况说明：末次妊娠类型、3 个疗程的起止、最近一次血 hCG 数值与日期。只陈述记录，不做任何判定。')}`;
}

function hcgRow(p) {
  const evSel = `<span class="ev-pick" role="group" aria-label="事件标记（三态，由你勾选）">${['plateau', 'rise', 'anchor'].map(k =>
    `<button class="chip${p.event === k ? ' on' : ''}" data-action="mark-event" data-d="${p.d}" data-ev="${k}" aria-pressed="${p.event === k}">${EVENT_LABEL[k]}</button>`).join('')}${p.event ? `<button class="chip soft" data-action="mark-event" data-d="${p.d}" data-ev="">取消</button>` : ''}</span>`;
  return row(
    `${esc(p.d)} · <b>${p.versions ? p.versions[p.versions.length - 1].v : p.v}</b> ${D.hcg.unit}`,
    `来源：${esc(p.src)}${p.versions ? ' · <button class="text-button" data-action="versions" data-d="' + p.d + '">查看版本链</button>' : ''}`,
    evSel
  );
}

/* ---------------- 检查与指标：二级页签页（血 hCG / 血常规 / 肝肾功能 / 体重 / 指标管理） ---------------- */
/* 二级结构选择：把原「hCG 时间线」一级页扩为带二级页签的「检查与指标」页（24 号规范：
   页内 Tab 承载化验分类，不把每种化验拆成全局菜单）；血 hCG 页签内容与原一级页完全一致。 */
function metricSubnav() {
  return `<nav class="subnav" role="tablist" aria-label="检查与指标二级页签">${METRIC_TABS.map(([k, l]) =>
    `<button role="tab" class="chip${state.metricTab === k ? ' on' : ''}" data-action="metric-tab" data-arg="${k}" aria-selected="${state.metricTab === k}">${esc(l)}</button>`).join('')}</nav>`;
}

/* 多系列线性趋势图：同单位序列同图双线（line-a / line-b）；每序列可点 chip 开关显隐；
   化疗疗程起止日画中性竖条背景（cycle-band，档案事实标注，不是判读）；无参考区间带。 */
function metricSeriesChart(seriesIn, hLabel) {
  const series = seriesIn.filter((s) => !state.metricHidden.has(s.key) && s.points.length);
  const CWm = 900, CHm = 300, X0 = 64, X1 = 860, Y0 = 28, Y1 = 240;
  const allPts = series.flatMap((s) => s.points);
  const toggles = seriesIn.map((s, i) =>
    `<button class="chip${state.metricHidden.has(s.key) ? '' : ' on'}" data-action="metric-toggle" data-arg="${s.key}" aria-pressed="${!state.metricHidden.has(s.key)}"><i class="dot-line sw${i % 2}"></i>${esc(s.name)}（${esc(s.unit)}）</button>`).join('');
  if (!series.length || !allPts.length) {
    return `<div class="chip-row" role="group" aria-label="序列显隐">${toggles}</div><div class="empty"><h3>暂无可画的数据点</h3><p>序列已隐藏或还没有记录；去「指标管理」页签补录或开 AI 导入候选。</p></div>`;
  }
  const ds = allPts.map((p) => Date.parse(p.d));
  const t0 = Math.min(...ds), t1 = Math.max(...ds);
  const vs = allPts.map((p) => p.v);
  let vmin = Math.min(...vs), vmax = Math.max(...vs);
  const padV = (vmax - vmin) * 0.12 || Math.abs(vmax || 1) * 0.1 || 1;
  vmin -= padV; vmax += padV;
  const xOf = (d) => X0 + (Date.parse(d) - t0) / Math.max(1, t1 - t0) * (X1 - X0);
  const yOf = (v) => Y1 - (v - vmin) / (vmax - vmin) * (Y1 - Y0);
  /* 疗程竖条：起止日之间的中性背景矩形（class="cycle-band"），title 写「第 N 疗 · 起止」档案事实 */
  const bands = D.cycles.map((c) => {
    const x = xOf(c.start), w = Math.max(4, xOf(c.end) - xOf(c.start));
    return `<rect class="cycle-band" x="${x.toFixed(1)}" y="${Y0}" width="${w.toFixed(1)}" height="${Y1 - Y0}"><title>第 ${c.n} 疗 · ${c.start} → ${c.end}（档案事实标注，不是判读）</title></rect>`;
  }).join('');
  /* 纵轴 4 条网格 + 数值刻度（只标数值，不标区间） */
  const grid = [0, 1, 2, 3].map((i) => {
    const v = vmin + (vmax - vmin) * (i / 3);
    return `<line class="grid" x1="${X0}" x2="${X1}" y1="${yOf(v).toFixed(1)}" y2="${yOf(v).toFixed(1)}"/><text class="tick" x="${X0 - 8}" y="${(yOf(v) + 3.5).toFixed(1)}" text-anchor="end">${v.toFixed(vmax - vmin > 20 ? 0 : 1)}</text>`;
  }).join('');
  const ticks = series[0].points.map((p) => {
    const d = new Date(Date.parse(p.d));
    return `<text class="tick" x="${xOf(p.d).toFixed(1)}" y="${Y1 + 16}" text-anchor="middle">${d.getMonth() + 1}/${d.getDate()}</text>`;
  }).join('');
  const paths = series.map((s, i) => {
    const coords = s.points.map((p) => ({ x: xOf(p.d), y: yOf(p.v) }));
    const dots = s.points.map((p) => `<circle class="pt" cx="${xOf(p.d).toFixed(1)}" cy="${yOf(p.v).toFixed(1)}" r="4"><title>${esc(p.d)} · ${p.v} ${esc(s.unit)} · ${esc(s.source || '')}</title></circle>`).join('');
    return `<path class="line sw${i % 2}" d="${smoothPath(coords)}" pathLength="1"/>${dots}`;
  }).join('');
  const label = hLabel || `${series.map((s) => `${s.name}（${s.unit}）`).join(' + ')} · 时间轴按真实采样日期`;
  return `<div class="chip-row" role="group" aria-label="序列显隐">${toggles}</div>
  <svg class="chart metric-chart" viewBox="0 0 ${CWm} ${CHm}" role="img" aria-label="${esc(label)}；纵轴为线性数值刻度，浅色竖条为化疗疗程起止（档案事实），不画参考区间带">
    ${bands}${grid}<line class="axis" x1="${X0}" x2="${X1}" y1="${Y1}" y2="${Y1}"/>${ticks}
    ${paths}
    <text class="tick" x="${X1}" y="${Y1 + 34}" text-anchor="end">竖条 = 化疗疗程起止（第几疗 · 档案事实标注）；数值照抄 · 单位恒随行 · 不画参考区间带</text>
  </svg>`;
}

/* 迷你 spark（指标管理清单行内）：只连线不标轴，点上去看数值 */
function metricSpark(points, unit) {
  if (points.length < 2) return '<span class="muted small">点数不足</span>';
  const W = 96, H = 28, vs = points.map((p) => p.v);
  const vmin = Math.min(...vs), vmax = Math.max(...vs);
  const coords = points.map((p, i) => ({ x: (i / (points.length - 1)) * (W - 8) + 4, y: H - 3 - (p.v - vmin) / Math.max(1e-9, vmax - vmin) * (H - 6) }));
  return `<svg class="metric-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path class="line" d="${smoothPath(coords)}" pathLength="1"/></svg>`;
}

function vMetricHcgTab() {
  return `${metricCatGrid()}
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

function seriesByGroup(g) { return (D.metrics ? D.metrics.series : []).filter((s) => s.group === g); }

function vMetricCbc() {
  const cbc = seriesByGroup('cbc');
  const same = cbc.filter((s) => s.unit === '×10⁹/L');          // WBC / NEUT 同单位同图双线
  const hgb = cbc.filter((s) => s.key === 'hgb');
  const plt = cbc.filter((s) => s.key === 'plt');
  const small = (list) => `<div class="card chart-card"><div class="card-head"><h2>${list.map((s) => esc(s.name)).join(' / ')} 趋势</h2><span class="muted">单位 ${esc(list[0].unit)} · 各自成图</span></div>
    <div class="chart-wrap">${metricSeriesChart(list)}</div></div>`;
  return `<div class="notice">${esc(D.metrics.note)}同单位可比的序列（WBC / NEUT，均为 ×10⁹/L）同图双线；HGB（g/L）与 PLT（×10⁹/L）各自成图，不做双轴。</div>
  <div class="card chart-card"><div class="card-head"><h2>白细胞与中性粒细胞趋势</h2><span class="muted">同单位 ×10⁹/L · 双序列可开关显隐</span></div>
    <div class="chart-wrap">${metricSeriesChart(same)}</div></div>
  ${small(hgb)}${small(plt)}
  ${agentPane('请帮我把化疗期血常规四项（WBC / NEUT / HGB / PLT）按日期整理成清单（日期 / 项目 / 数值 / 单位 / 来源），数值原文照抄，不写高低、不加解释。')}`;
}

function vMetricLiver() {
  const liver = seriesByGroup('liver');
  const same = liver.filter((s) => s.unit === 'U/L');           // ALT / AST 同单位同图双线
  const cr = liver.filter((s) => s.key === 'cr');
  return `<div class="notice">${esc(D.metrics.note)}ALT 与 AST（均为 U/L）同图双线；Cr（μmol/L）各自成图，不做双轴。</div>
  <div class="card chart-card"><div class="card-head"><h2>谷丙 / 谷草转氨酶趋势</h2><span class="muted">同单位 U/L · 双序列可开关显隐</span></div>
    <div class="chart-wrap">${metricSeriesChart(same)}</div></div>
  <div class="card chart-card"><div class="card-head"><h2>肌酐趋势</h2><span class="muted">单位 μmol/L · 各自成图</span></div>
    <div class="chart-wrap">${metricSeriesChart(cr)}</div></div>
  ${agentPane('请帮我把化疗期肝肾功能三项（ALT / AST / Cr）按日期整理成清单（日期 / 项目 / 数值 / 单位 / 来源），数值原文照抄，不写高低、不加解释。')}`;
}

function vMetricWeight() {
  const w = D.nutrition.weight;
  const series = [{ key: 'weight', name: '体重', unit: 'kg', points: w, source: '手工记录' }];
  return `<div class="notice">体重序列由「营养支持」页的手工记录并入同一来源；数值照抄、单位恒随行（kg），无参考区间带。</div>
  <div class="card chart-card"><div class="card-head"><h2>体重序列趋势（${w.length} 点）</h2><span class="muted">完整序列图 · kg</span></div>
    <div class="chart-wrap">${metricSeriesChart(series)}</div>
    <div class="rows">${row('最近一次', `${w[w.length - 1].d} · ${w[w.length - 1].v} kg · 手工记录`)}</div>
    <div class="actions"><button class="soft" data-action="go" data-arg="nutrition">去营养支持记体重 →</button></div>
  </div>
  ${agentPane('请帮我把化疗期到随访期的体重记录按日期列成清单（日期 / 数值 / 单位），只陈述记录，不做任何变化方向的解读。')}`;
}

/* 指标管理：全部指标序列清单（分节走 section_titles 心智：血 hCG / 血常规 / 肝肾功能 / 体重）。 */
function metricManageRow(s) {
  const last = s.points[s.points.length - 1];
  const hidden = state.metricHidden.has(s.key);
  return `<div class="row"><div class="row-main"><div>
    <b>${esc(s.name)}</b><p>${esc(s.unit)} · 已记录 ${s.points.length} 次 · 最近 ${esc(last.d)} · <b>${last.v} ${esc(s.unit)}</b> · 来源：${esc(s.source)}</p>
    ${s.note ? `<p class="muted small">报告原文照抄：${esc(s.note)}</p>` : ''}
  </div></div>
  <div class="row-side metric-row-side">
    ${metricSpark(s.points, s.unit)}
    <div class="chip-row">
      <button class="chip${hidden ? '' : ' on'}" data-action="metric-toggle" data-arg="${esc(s.key)}" aria-pressed="${!hidden}">${hidden ? '已隐藏' : '显示中'}</button>
      ${moreMenu([{ action: 'metric-ai-cand', arg: s.key, label: 'AI：导入候选（不代发）' }, { action: 'metric-add', arg: s.key, label: '手工补录一个值（数字键盘）' }])}
    </div>
  </div></div>`;
}

function vMetricManage() {
  const hcgSeries = { key: 'bhcg', name: '血 hCG', unit: D.hcg.unit, points: D.hcg.points, source: '市一医院' };
  const weightSeries = { key: 'bweight', name: '体重', unit: 'kg', points: D.nutrition.weight, source: '手工记录' };
  return `<div class="notice">这里是全部指标序列的清单：看记录数与最近值、设置序列显隐、发起 AI 导入候选（gtn:agent-draft 契约：只起草不代发）或「⋯ 更多」手工补录（数字键盘）。要改一个已入档的值，走对应记录的「改这一条」——更正=新增版本，旧值进版本链，没有裸删除。</div>
  <div class="card"><div class="card-head"><h2>指标序列清单</h2><span class="muted">分节：血 hCG / 血常规 / 肝肾功能 / 体重</span></div>
    <div class="section-titles muted small">分节：血 hCG / 血常规 / 肝肾功能 / 体重 · 每行：序列名 / 单位 / 记录数 / 最近值 + 日期 / 迷你 spark / 来源</div>
    <div class="rows">
      <div class="subhead">血 hCG</div>
      ${metricManageRow(hcgSeries)}
      <div class="subhead">血常规</div>
      ${seriesByGroup('cbc').map(metricManageRow).join('')}
      <div class="subhead">肝肾功能</div>
      ${seriesByGroup('liver').map(metricManageRow).join('')}
      <div class="subhead">体重</div>
      ${metricManageRow(weightSeries)}
    </div>
  </div>
  ${agentPane('请帮我把全部指标序列整理成一张清单（序列名 / 单位 / 记录数 / 最近值与日期 / 来源），按血 hCG、血常规、肝肾功能、体重分节；数值原文照抄，不写高低与结论。')}`;
}

const METRIC_TAB_VIEWS = { bhcg: vMetricHcgTab, cbc: vMetricCbc, liver: vMetricLiver, weight: vMetricWeight, manage: vMetricManage };

function vHcg() {
  const view = METRIC_TAB_VIEWS[state.metricTab] || vMetricHcgTab;
  return `${pageHead('hcg')}
  ${metricSubnav()}
  ${view()}`;
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
    <div class="section-titles muted small">分节：病理 / 影像 · 每条保留报告日期与医院，原文不改写</div>
    <div class="rows">
      <div class="subhead">病理</div>
      ${D.pathology.filter(x => x.src.includes('病理')).map(x => row(esc(x.src), esc(x.text))).join('')}
      <div class="subhead">影像</div>
      ${D.pathology.filter(x => !x.src.includes('病理')).map(x => row(esc(x.src), esc(x.text))).join('')}
    </div>
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
  /* 月历格子视图：一格一月，打点=已记录，描边=已到期未记录，虚线=未到月 */
  const grid = months.map(m => {
    const cls = m.rec ? 'hit' : m.reached ? 'due' : 'later';
    const mark = m.rec ? `hCG ${esc(m.rec.hcg)} ${D.hcg.unit}` : m.reached ? '已到期待记录' : `约 ${esc(m.due)}`;
    return `<div class="cal-cell ${cls}"><b>第 ${m.n} 月</b><span>${esc(mark)}</span>${m.rec ? '<i class="cal-dot"></i>' : ''}</div>`;
  }).join('');
  return `${pageHead('followup')}
  <div class="notice">随访月份以 <b>${esc(f.anchorLabel)} · ${esc(f.anchor)}</b> 为锚点生成；未到月置灰，不提供预填。这里不输出任何关于再生育时机的结论，避孕与再生育安排以你的医嘱为准。</div>
  <div class="card"><div class="card-head"><h2>月历总览（${f.planMonths} 个月）</h2><span class="muted">格视图 · 打点=已记录</span></div>
    <div class="cal-grid">${grid}</div>
    <p class="legend"><span class="line-chip"><i class="cal-dot"></i>已记录</span><span class="line-chip">描边格=已到期未记录</span><span class="line-chip">虚线格=未到月</span></p>
  </div>
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
  ${agentPane('请帮我解析这份化验单照片，抽出日期 / 数值 / 单位 / 医院四个字段做候选，逐项等我核对；数值原文照抄，不判定高低。')}
      ${quoteLine(QUOTE.none)}`;
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
      <div class="section-titles muted small">材料分节：数值 → 疗程 → 评分 → 问题清单；与各业务页同源渲染</div>
      ${sel.hcg ? `<h3 class="subhead">数值 · 血 hCG 时间线</h3><div class="rows">${row('记录范围', `${D.hcg.points[0].d} → ${last.d}，共 ${D.hcg.points.length} 点`)}${row('最近一次', `${last.d} · ${last.v} ${D.hcg.unit}`)}${row('事件标记', D.hcg.points.filter(p => p.event).map(p => `${p.d} ${EVENT_LABEL[p.event]}`).join('；') || '无')}</div>` : ''}
      ${sel.cycles ? `<h3 class="subhead">疗程 · 折叠卡展开</h3><div class="rows">${D.cycles.map(c => row(`第 ${c.n} 疗 · ${esc(c.regimen)}`, `${c.start} → ${c.end} · 当日 hCG ${c.hcgOnDay} ${D.hcg.unit}`)).join('')}</div>` : ''}
      ${sel.figo ? `<h3 class="subhead">评分 · FIGO 自录（照抄）</h3><div class="rows">${D.figo.map(it => row(esc(it.k), `${esc(it.opts[it.picked])} · ${it.picked} 分`)).join('')}${row('总分（自动求和）', String(figoTotal()) + ' · 总分求和不代表分级建议')}</div>` : ''}
      ${sel.questions ? `<h3 class="subhead">问题清单</h3><div class="rows">${D.questions.map((q, i) => row(`${i + 1}. ${esc(q)}`, '')).join('')}</div>` : ''}
    </div>`;
  }
  return `${pageHead('review')}
  <div class="card"><div class="card-head"><h2>勾选范围</h2></div>
    <div class="check-list">${items.map(([k, l]) => `<label class="check-row"><input type="checkbox" data-review="${k}" ${sel[k] ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
    <div class="actions"><button data-action="gen-review">生成预览</button></div>
    <div class="notice">生成失败保留草稿勾选；材料与档案同源（demo 数据唯一来源）。</div>
  </div>
  ${preview || emptyBox('还没有生成预览', '勾选上面要带上的范围，点「生成预览」。')}
  ${agentPane('请帮我把复诊材料压缩成一页口头汇报：先数值（最近 hCG），再疗程，最后三个最想问的问题；只整理我记录的内容，不加建议。')}
      ${quoteLine(QUOTE.none)}`;
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

/* ---------------- 病情一图秀（16 号 one-chart：一张图讲完病程） ---------------- */
function oneshowChart() {
  const stages = [
    { x: 20, w: 120, name: '清宫', span: '2026-03-12' },
    { x: 140, w: 320, name: 'hCG 序列（周查）', span: '03-16 → 06-22 · 16 点' },
    { x: 460, w: 300, name: 'MTX 单药 × 3 疗', span: '04-20 → 06-19' },
    { x: 760, w: 180, name: '锚点后随访', span: '2026-07 → 至今' }
  ];
  const bar = stages.map((s, i) => `<g><rect class="stage" x="${s.x}" y="120" width="${s.w}" height="40" rx="8"/>
    <text class="stage-name" x="${s.x + s.w / 2}" y="145" text-anchor="middle">${esc(s.name)}</text>
    <text class="tick" x="${s.x + s.w / 2}" y="180" text-anchor="middle">${esc(s.span)}</text></g>`).join('');
  /* 关键事件点：均"由你勾选 / 档案自述"口径，工具不做判定 */
  const events = [
    { x: 80, y: 120, label: '清宫（档案自述）', tip: '2026-03-12 · 完全性葡萄胎清宫 · 市一医院' },
    { x: 300, y: 120, label: '平台期（你勾选）', tip: '2026-04-20 · 8800 IU/L · 事件标记由你勾选' },
    { x: 445, y: 120, label: 'hCG 反弹（你勾选）', tip: '2026-06-01 · 512 IU/L · 事件标记由你勾选' },
    { x: 750, y: 120, label: 'hCG 达正常锚点（你勾选）', tip: '2026-06-22 · 6 IU/L · 随访月以此为起点' },
    { x: 800, y: 120, label: '随访 3 个月', tip: '2026-07/08/09 · 各月 hCG 已记录' }
  ];
  const dots = events.map(e => `<path class="ev" d="M ${e.x} ${e.y - 26} l6 6 -6 6 -6 -6 Z"><title>${esc(e.tip)}</title></path>
    <text class="ev-label" x="${e.x}" y="${e.y - 36}" text-anchor="middle">${esc(e.label)}</text>`).join('');
  const arrows = stages.slice(0, -1).map((s) => `<path class="stage-link" d="M ${s.x + s.w + 2} 140 h 14" marker-end="url(#arr)"/>`).join('');
  return `<svg class="chart" viewBox="0 0 960 260" role="img" aria-label="林小葡全程病程一张图：清宫、hCG 周序列、三个 MTX 疗程、hCG 达正常锚点与按月随访；阶段条自左向右，关键事件点均由本人勾选或档案自述">
    <defs><marker id="arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#cfc2e2"/></marker></defs>
    ${bar}${arrows}${dots}
    <text class="tick" x="940" y="248" text-anchor="end">一张图口径：阶段与事件均来自本档案记录（事件由你勾选 / 档案自述）；不画参考区间带</text>
  </svg>`;
}

function vOneshow() {
  const series = oneshowSeries();
  const groups = ['血 hCG', '血常规', '肝肾功能', '体重'];
  const pickers = groups.map(g => {
    const list = series.filter(x => x.group === g);
    if (!list.length) return '';
    return `<div class="cat-label">${esc(g)}</div>` + list.map(x =>
      `<label class="metric-pick"><input type="checkbox" data-oc-metric="${x.key}" ${state.oneshow.sel.includes(x.key) ? 'checked' : ''}><i style="background:${x.color}"></i><span>${esc(x.name)}</span><small>${x.points.length ? x.points[x.points.length - 1].v : '—'}</small></label>`).join('');
  }).join('');
  return `${pageHead('oneshow')}
  <div class="one-grid">
    <aside class="rail" aria-label="一图秀筛选项">
      <section><h3>时间范围</h3><div class="chips">
        ${[['3m', '近 3 月'], ['6m', '近 6 月'], ['12m', '近 12 月'], ['all', '全部']].map(([k, l]) => `<button class="chip${state.oneshow.range === k ? ' on' : ''}" data-action="oc-range" data-arg="${k}" aria-pressed="${state.oneshow.range === k}">${l}</button>`).join('')}
      </div></section>
      <section><h3>选择指标 <small>最多 4 个 · 已选 ${state.oneshow.sel.length}</small></h3>
        ${pickers}
        <p class="muted small">点选后图表立即更新。</p>
      </section>
      <section><h3>显示内容</h3><div class="chips">
        ${[['treatment', '治疗节点'], ['keypoints', '关键点数值'], ['changes', '变化 ≥20%']].map(([k, l]) => `<button class="chip${state.oneshow.toggles[k] ? ' on' : ''}" data-action="oc-toggle" data-arg="${k}" aria-pressed="${state.oneshow.toggles[k]}">${l}</button>`).join('')}
      </div></section>
    </aside>
    <div class="one-main">
      <section class="card chart-card"><div class="card-head"><h2>病程时间轴</h2><span class="muted">只呈现已记录的值 · 每条线按自身范围缩放</span></div>
        <div class="legend">${oneshowLegend(series)}</div>
        <div class="chart-wrap">${oneshowMultiChart(series)}</div>
        <div id="oc-pin">${oneshowPinHTML(series)}</div>
      </section>
    </div>
  </div>
  <div class="card"><div class="card-head"><h2>病程阶段条（档案事实，非判读）</h2></div>
    <div class="chart-wrap">${oneshowChart()}</div>
    <p class="muted small">阶段与事件均来自本档案记录（事件由你勾选 / 档案自述）；不画参考区间带。</p>
  </div>
  <div class="card"><div class="card-head"><h2>阶段清单（与图同源）</h2></div>
    <div class="rows">
      ${row('清宫', '2026-03-12 · 完全性葡萄胎 · 市一医院（档案自述）')}
      ${row('hCG 周序列', '2026-03-16 → 06-22 · 16 点 · 事件标记 3 个（你勾选）')}
      ${row('化疗', 'MTX 单药 × 3 疗 · 2026-04-20 → 06-19')}
      ${row('hCG 达正常锚点', '2026-06-22 · 6 IU/L · 你勾选，随访以此为起点')}
      ${row('随访', '第 1–3 个月已记录 · 计划 12 个月')}
    </div>
    ${quoteLine(QUOTE.s1)}
  </div>
  ${agentPane('请帮我把一图秀的五个阶段各写一句话，给不熟悉病情的家人看：只陈述日期与记录，不加判定、不用医学结论词。')}
  ${quoteLine(QUOTE.none)}`;
}

/* 一图秀序列集：hCG 主线 + 多系列指标 + 体重（breast rail 口径，分组勾选 ≤4）。 */
const ONE_PALETTE = ['#8a4b6f', '#2f6f8f', '#4b8a5a', '#b0803a', '#7a5ab0', '#a04b4b', '#3a8a8a', '#8a7a3a'];
function oneshowSeries() {
  const list = [];
  const add = (key, name, unit, group, points, source, color) => { if (points.length) list.push({ key, name, unit, group, points, source, color }); };
  add('hcg', `血 hCG（${D.hcg.unit}，对数心智）`, D.hcg.unit, '血 hCG', D.hcg.points.map(p => ({ d: p.d, v: p.v, src: p.src })), 'hCG 时间线', ONE_PALETTE[0]);
  const G = { cbc: '血常规', liver: '肝肾功能' };
  D.metrics.series.forEach((s, i) => add(s.key, `${s.name}（${s.unit}）`, s.unit, G[s.group] || s.group, s.points, s.source, ONE_PALETTE[(i + 1) % ONE_PALETTE.length]));
  add('weight', '体重（kg）', 'kg', '体重', D.nutrition.weight.map(p => ({ d: p.d, v: p.v, src: '手工记录' })), '营养支持', ONE_PALETTE[7]);
  return list;
}
function oneshowDomain() {
  const t = oneshowSeries().flatMap(x => x.points.map(p => Date.parse(p.d)));
  const t1 = Math.max(...t, Date.now());
  if (state.oneshow.range === '3m') return [t1 - 92 * 864e5, t1];
  if (state.oneshow.range === '6m') return [t1 - 183 * 864e5, t1];
  if (state.oneshow.range === '12m') return [t1 - 365 * 864e5, t1];
  return [Math.min(...t), t1];
}
function oneshowLegend(series) {
  return series.filter(x => state.oneshow.sel.includes(x.key)).map(x => {
    const vs = x.points.map(p => p.v);
    return `<span class="line-chip"><i style="background:${x.color}"></i><b>${esc(x.name)}</b> 最近 ${vs[vs.length - 1]} ${esc(x.unit)} <em>全期 ${Math.min(...vs)}–${Math.max(...vs)}</em></span>`;
  }).join('');
}
function oneshowPinHTML(series) {
  if (!state.oneshow.pin) return '<p class="muted small">点击曲线上的记录点，可查看数值、日期与来源。</p>';
  const [key, d] = state.oneshow.pin.split('|');
  const x = series.find(s => s.key === key);
  const p = x && x.points.find(q => q.d === d);
  if (!p) return '<p class="muted small">这个记录点已不在当前时间窗内。</p>';
  return `<div class="pinbox"><div><b>${esc(x.name)} ${p.v} ${esc(x.unit)}</b>
    <p class="muted" style="margin:2px 0">${p.d} · 来源：${esc(p.src)}</p>
    <p class="muted small" style="margin:2px 0">趋势只用于回顾记录，不构成诊断或疗效判断。</p></div>
    <button class="soft" data-action="oc-unpin">收起</button></div>`;
}
function oneshowMultiChart(series) {
  const sel = series.filter(x => state.oneshow.sel.includes(x.key));
  const [t0, t1] = oneshowDomain();
  if (!sel.length) return emptyBox('还没有选择指标', '在左侧勾选最多 4 个指标，图表立即更新。');
  const withPts = sel.map(x => ({ ...x, pts: x.points.filter(p => { const t = Date.parse(p.d); return t >= t0 && t <= t1; }) })).filter(x => x.pts.length);
  if (!withPts.length) return emptyBox('所选指标在这个时间窗里没有记录', '扩大时间范围，或在左侧换选一个指标。');
  const w = 900, h = 340, pad = { l: 30, r: 20, t: 26, b: 46 };
  const X = d => pad.l + (Date.parse(d) - t0) / Math.max(t1 - t0, 1) * (w - pad.l - pad.r);
  let out = '';
  /* 治疗色带：中性背景（档案事实标注，不是判读） */
  if (state.oneshow.toggles.treatment) {
    for (const c of D.cycles) {
      const x1 = X(c.start), x2 = X(c.end || c.start);
      out += `<rect x="${x1.toFixed(1)}" y="${pad.t - 10}" width="${Math.max(x2 - x1, 3).toFixed(1)}" height="${h - pad.t - pad.b + 14}" fill="#9db8a8" opacity="0.16"><title>第${c.no}疗 ${c.start} → ${c.end}（档案事实标注，不是判读）</title></rect>`;
    }
  }
  for (const x of withPts) {
    const vs = x.pts.map(p => p.v);
    const lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || Math.max(Math.abs(hi) * 0.08, 1);
    const Y = v => h - pad.b - (v - lo) / span * (h - pad.t - pad.b);
    const coords = x.pts.map(p => ({ x: X(p.d), y: Y(p.v) }));
    out += `<path class="line" d="${smoothPath(coords)}" pathLength="1" style="stroke:${x.color}"/>`;
    coords.forEach((c, i) => {
      const p = x.pts[i], prev = x.pts[i - 1];
      let tag = '';
      if (prev && state.oneshow.toggles.changes && Math.abs((p.v - prev.v) / Math.max(Math.abs(prev.v), 1)) >= 0.2) {
        const pct = Math.round((p.v - prev.v) / Math.abs(prev.v) * 100);
        tag += `<text x="${(c.x + 6).toFixed(1)}" y="${(c.y - 7).toFixed(1)}" fill="${x.color}" font-size="10">${pct > 0 ? '+' : ''}${pct}%</text>`;
      }
      if (i === coords.length - 1 && state.oneshow.toggles.keypoints) tag += `<text x="${(c.x - 5).toFixed(1)}" y="${(c.y - 9).toFixed(1)}" text-anchor="end" fill="${x.color}" font-size="10.5" style="font-weight:600">${p.v}</text>`;
      out += `<circle class="pt" data-action="oc-pin" data-arg="${x.key}|${p.d}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" fill="${x.color}" style="cursor:pointer"><title>${esc(x.name)} ${p.v} ${esc(x.unit)} · ${p.d} · ${esc(p.src)}</title></circle>${tag}`;
    });
  }
  const months = []; const cur = new Date(t0); cur.setDate(1);
  while (cur.getTime() <= t1) { if (cur.getTime() >= t0) months.push({ x: X(cur.toISOString().slice(0, 10)), l: cur.getFullYear() + '.' + (cur.getMonth() + 1) }); cur.setMonth(cur.getMonth() + 1); }
  out += months.filter((m, i) => months.length > 10 ? i % 2 === 0 : true).map(m => `<text class="tick" x="${m.x.toFixed(1)}" y="${h - 18}" text-anchor="middle">${m.l}</text>`).join('');
  out += `<text class="tick" x="${w - pad.r}" y="${h - 3}" text-anchor="end">每条线按该指标全部记录范围缩放，不代表不同指标数值可比</text>`;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="已选 ${withPts.length} 个指标趋势；每条线按自身范围绘制，点选记录点可查看数值与来源">${out}</svg>`;
}

/* ---------------- 营养支持 ---------------- */
function weightSpark() {
  const w = D.nutrition.weight;
  const x0 = 30, x1 = 420, y0 = 24, y1 = 96;
  const vs = w.map(p => p.v);
  const vmin = Math.min(...vs) - 0.5, vmax = Math.max(...vs) + 0.5;
  const coords = w.map((p, i) => ({ x: x0 + (i / (w.length - 1)) * (x1 - x0), y: y1 - (p.v - vmin) / (vmax - vmin) * (y1 - y0) }));
  return `<svg class="chart weight-spark" viewBox="0 0 450 130" role="img" aria-label="体重序列小图，共 ${w.length} 点，单位 kg">
    <path class="line" d="${smoothPath(coords)}" pathLength="1"/>
    ${w.map((p, i) => `<circle class="pt" cx="${coords[i].x.toFixed(1)}" cy="${coords[i].y.toFixed(1)}" r="4"><title>${p.d} · ${p.v} kg · 手工记录</title></circle>
      <text class="tick" x="${coords[i].x.toFixed(1)}" y="${(y1 + 16).toFixed(1)}" text-anchor="middle">${p.d.slice(5)}</text>`).join('')}
    <text class="tick" x="${x1}" y="14" text-anchor="end">体重（kg）· 仅陈述记录</text>
  </svg>`;
}

function vNutrition() {
  const n = D.nutrition;
  const ulcerMeals = n.meals.filter(m => m.ulcer === '有');
  return `${pageHead('nutrition')}
  <div class="notice">${esc(n.note)}</div>
  <div class="card"><div class="card-head"><h2>化疗期饮食记录（${n.meals.length} 条）</h2><div class="head-actions">${moreMenu([{ action: 'add-meal', label: '手工记一餐（≤6 字段）' }, { action: 'ai-meal-cand', label: 'AI：拍餐盘照片出候选' }])}</div></div>
    <div class="rows">${n.meals.slice().reverse().map(m => row(
      `${esc(m.d)} · ${esc(m.meal)}`,
      `${esc(m.intake)} · 口腔情况：${m.ulcer === '有' ? '有溃疡——' + esc(m.ulcerNote || '按自述记录影响') : '无溃疡记录'} · 叶酸：${esc(m.folate)}`
    )).join('')}</div>
    ${quoteLine(n.quote)}
  </div>
  <div class="card"><div class="card-head"><h2>口腔溃疡期进食影响（${ulcerMeals.length} 条）</h2>${pill('按用户自述记录', 'grey')}</div>
    <div class="rows">${ulcerMeals.map(m => row(`${esc(m.d)} · ${esc(m.meal)}`, esc(m.ulcerNote || '（自述有溃疡，未写细节）'))).join('')}</div>
    <div class="notice">化疗期口腔溃疡较常见；这里只记录它对进食的影响（你的自述），不给处理方案，用什么漱口 / 药物请照医嘱。</div>
  </div>
  <div class="card"><div class="card-head"><h2>体重序列（${n.weight.length} 点）</h2><span class="muted">手工记录 · kg</span></div>
    <div class="chart-wrap">${weightSpark()}</div>
    <div class="rows">${row('最近一次', `${n.weight[n.weight.length - 1].d} · ${n.weight[n.weight.length - 1].v} kg`)}</div>
  </div>
  ${agentPane('请帮我把化疗期间的饮食记录按周整理成清单（日期 / 餐次 / 吃了什么 / 口腔情况），保持自述原文，不加营养建议、不判定轻重。')}
  ${quoteLine(QUOTE.none)}`;
}

/* ---------------- 心理支持 ---------------- */
const MOOD_LABEL = { ok: '还好', flat: '平稳', down: '低落' };

function vMind() {
  const m = D.mind;
  const privateBadge = pill('私密 · 仅本机', 'violet');
  return `${pageHead('mind')}
  <div class="notice">这一页的所有记录默认私密（is_private 心智）：仅本机保存，不进复诊材料、不进 AI 上下文摘要，除非你逐条主动选择。</div>
  <div class="card"><div class="card-head"><h2>情绪日记（${m.moods.length} 条）</h2><div class="head-actions">${privateBadge}<div class="head-actions"><button data-action="add-mood">${esc(ENTRY_P9)}</button></div></div></div>
    <div class="rows">${m.moods.slice().reverse().map(x => row(`${esc(x.d)} · ${MOOD_LABEL[x.state] || ''}`, esc(x.text), pill(MOOD_LABEL[x.state] || '', 'grey'))).join('')}</div>
    ${quoteLine(m.quote)}
  </div>
  <div class="card"><div class="card-head"><h2>等待 hCG 报告日（${m.waitDays.length} 条）</h2>${pill('GTN 特异场景', 'grey')}</div>
    <div class="rows">${m.waitDays.slice().reverse().map(x => row(`${esc(x.d)} · 等报告日`, `${esc(x.text)} · 当时这么撑过去：${esc(x.cope)}`)).join('')}</div>
    <div class="actions"><button class="soft" data-action="add-wait">记一个等报告日</button></div>
  </div>
  <div class="card"><div class="card-head"><h2>家庭 / 伴侣沟通记录（${m.family.length} 条）</h2>${privateBadge}</div>
    <div class="rows">${m.family.slice().reverse().map(x => row(`${esc(x.d)} · 与${esc(x.who)}`, esc(x.text))).join('')}</div>
    <div class="notice">沟通记录只留你这一侧的叙述，不替对方写结论；再生育相关话题以你的医嘱为准，工具不做安排。</div>
  </div>
  <div class="card"><div class="card-head"><h2>心理资源清单</h2></div>
    ${m.resources.length ? '' : emptyBox('还没有可列的心理资源', '如实说明：本演示未接入、也未核实任何心理咨询 / 病友组织资源；「未核实」的资源一律不展示。')}
  </div>
  ${agentPane('请帮我把等报告日的记录整理成一段给医生看的描述（只写日期和我的状态，不加判断）；注意：情绪与家庭记录是私密内容，不要放进摘要。')}
  ${quoteLine(QUOTE.none)}`;
}

/* ---------------- 临床研究（登记摘录 + 三档匹配，MATCHING-SPEC §4） ---------------- */
/* 入组档案（GTN 版）：全部来自既有病情数据，本页只读不录；缺失字段 → 对应条件「无法自动匹配」，不阻断（35 号）。 */
function matchProfileFields() {
  const first = D.hcg.points[0];
  const ct = D.pathology.find((x) => !x.src.includes('病理'));
  return [
    { k: '年龄', v: `${D.patient.age} 岁`, src: '患者档案' },
    { k: '末次妊娠类型', v: D.pregnancy.type, src: '末次妊娠档案' },
    { k: '治疗前血 hCG', v: `${first.v} ${D.hcg.unit}（${first.d}，序列首点）`, src: 'hCG 时间线' },
    { k: 'FIGO 评分八项原始分', v: `已照抄（总分自动求和 ${figoTotal()}，不代表分级建议）`, src: 'FIGO 自录表' },
    { k: '分期原文', v: '无单独分期原文记录（FIGO/WHO 2000 评分自录，见诊断档案）', src: '诊断档案' },
    { k: '化疗线数与方案', v: `1 线 · ${D.cycles[0].regimen} × ${D.cycles.length} 疗（${D.cycles[0].start} → ${D.cycles[D.cycles.length - 1].end}）`, src: '治疗记录' },
    { k: '血常规最近值', v: D.cycles[D.cycles.length - 1].fields['复查血象'] || null, src: '疗程卡' },
    { k: '肝肾功能最近值', v: null, src: '资料档案（有报告摘录，逐项数值未入档）' },
    { k: '转移部位记录', v: ct ? `肺（${ct.src}：结节约 0.8 cm，转移待排——原文摘录）` : null, src: '病理/影像摘录' },
    { k: '规律随访安排', v: null, src: '（无对应记录）' }
  ];
}

/* 35 号分层文案：命中三分层 + 无法自动匹配；不产出满足/不适合类结论。 */
const LAYER_LABEL = { structured: '结构化命中', text: '文本命中', broad: '宽口径命中' };
const LAYER_MARK = { structured: '◆', text: '▪', broad: '○' };

/* AI 协助匹配的预写提示词（gtn:agent-draft 契约：只放进输入框，不自动发送）。 */
function matchPrompt() {
  const fields = matchProfileFields();
  const summary = fields.map((f) => `${f.k}：${f.v || '未记录'}`).join('；');
  const ids = D.trials.items.map((i) => i.recordId).join(' / ');
  return `请协助我把入组档案与 ${D.trials.items.length} 条登记研究逐条比对。档案摘要——${summary}。试验列表——${ids}。要求：按「结构化命中 / 文本命中 / 宽口径命中 / 无法自动匹配」分层列出，每条写清命中条件原文、你的记录与来源；本地无对应结构化字段的条件逐条标「无法自动匹配」并写原因；不输出数值综合分、不排序、不写哪条更适合我、不写「你不适合/你能入组」；入组判断属于医生与研究中心。`;
}

/* 单条试验的分层结果卡（35 号三态：命中分层陈列 + 无法自动匹配列原因；宽口径排末尾）。 */
/* 粗筛符合度（biliary 口径）：符合项 ÷ 已对照项；无法自动匹配按 0 计——只会偏低、不会偏高；不是入组资格。 */
function matchBand(e) {
  const met = e.rules.filter((r) => r.tier === 'satisfied').length;
  const unmet = e.rules.filter((r) => r.tier === 'conflict').length;
  const unknown = e.rules.filter((r) => r.tier === 'undetermined').length;
  const pct = Math.round((met / Math.max(1, met + unmet + unknown)) * 100);
  const band = (pct >= 80 && unknown <= 1) ? ['high', '高度符合'] : pct >= 55 ? ['partial', '部分符合'] : ['needs_info', '需补充信息'];
  return { met, unmet, unknown, pct, band };
}
const BAND_ORDER = { high: 0, partial: 1, needs_info: 2 };

function matchResultCard(e) {
  const item = D.trials.items.find((t) => t.recordId === e.recordId);
  const hits = e.rules.filter((r) => r.tier === 'satisfied' || r.tier === 'conflict');
  const order = { structured: 0, text: 1, broad: 2 };
  const sorted = hits.slice().sort((a, b) => (order[a.layer] ?? 3) - (order[b.layer] ?? 3));
  const unmatched = e.rules.filter((r) => r.tier === 'undetermined');
  const layerBadge = (r) => `<span class="pill${r.layer === 'broad' ? ' grey' : ''}" title="${LAYER_LABEL[r.layer] || '命中'}">${LAYER_MARK[r.layer] || '·'} ${LAYER_LABEL[r.layer] || '命中'}</span>`;
  const hitRow = (r) => `<div class="row"><div class="row-main"><div><b>${esc(r.text)}${r.tier === 'conflict' ? '<em class="muted">（你的记录与条件数值不同——如实陈列，核实请与研究方）</em>' : ''}</b>
    <p>你的记录：${esc(r.mine)} · 来源：${esc(r.src)}</p></div>${layerBadge(r)}</div></div>`;
  const unRow = (r) => `<div class="row"><div class="row-main"><div><b>${esc(r.text)}</b><p>无法自动匹配：${esc(r.mine)}</p></div><span class="pill grey">无法自动匹配</span></div></div>`;
  const fav = state.trialFavs.has(e.recordId);
  const nl = { structured: hits.filter(r => r.layer === 'structured').length, text: hits.filter(r => r.layer === 'text').length, broad: hits.filter(r => r.layer === 'broad').length };
  const mb = matchBand(e);
  return `<div class="cand">
    <div class="cand-head"><b>${esc(item ? item.title : e.recordId)}</b>
      <div class="head-actions"><span class="fitbox ${mb.band[0]}"><b>${mb.pct}<small>%</small></b><span>粗筛符合度</span><em>${mb.band[1]}</em></span><button class="chip${fav ? ' on' : ''}" data-action="trial-fav" data-arg="${esc(e.recordId)}" aria-pressed="${fav}">☆ 收藏</button></div></div>
    <div class="match-counts">${pill(`符合 ${mb.met}`, 'green')}${mb.unmet ? pill(`不符合 ${mb.unmet}`, 'grey') : ''}${mb.unknown ? pill(`无法自动匹配 ${mb.unknown}`, 'grey') : ''}${e.pending.length ? pill(`待确认规则 ${e.pending.length}`, 'grey') : ''}</div>
    <p class="muted">分层陈列：结构化 ${nl.structured} · 文本 ${nl.text} · 宽口径 ${nl.broad}（宽口径排末尾）——每条给条件原文、你的记录与来源；不代为挑选试验</p>
    <div class="subhead">命中（分层陈列：条件原文 + 你的记录 + 来源）</div>
    ${sorted.map(hitRow).join('') || '<p class="muted small">（无命中条目）</p>'}
    <div class="subhead">无法自动匹配（本地无对应结构化字段，逐条列原因）</div>
    ${unmatched.map(unRow).join('') || '<p class="muted small">（全部条件均已比对）</p>'}
    ${e.pending.length ? `<div class="subhead">⏳ 待确认规则（不进统计）</div>${e.pending.map((p) => `<div class="row"><div class="row-main"><div><b>${esc(p)}</b></div></div></div>`).join('')}` : ''}
    <p class="muted small">${esc(D.match.footerNote)}</p>
    <p class="muted small">登记号 ${esc(e.recordId)} · 来源通道与终态：${esc(D.match.channelsNote)} · 排序按数据来源顺序，不按命中程度</p>
    <p class="muted small">登记状态，未核实 · 登记状态 ≠ 有效 ≠ 可入组</p>
  </div>`;
}
function vTrials() {
  const sub = state.trialSub || 'match';
  const subBtn = ([k, l]) => `<button class="chip${sub === k ? ' on' : ''}" data-action="trial-sub" data-arg="${k}" aria-pressed="${sub === k}">${l}</button>`;
  return `${pageHead('trials')}
  <div class="notice">${esc(D.trials.disclaimer)}</div>
  <div class="chip-row" role="tablist" aria-label="临床研究子页">${subBtn(['match', '匹配'])}${subBtn(['search', '检索'])}${subBtn(['follow', '收藏跟踪'])}</div>
  ${sub === 'match' ? vTrialsMatch() : sub === 'search' ? vTrialsSearch() : vTrialsFollow()}`;
}

function vTrialsMatch() {
  const t = D.trials;
  const filters = [
    ['all', `全部来源（${t.items.length}）`],
    ['chinadrugtrials', '中国药物临床试验登记平台'],
    ['other', '其它来源（演示空态）']
  ];
  const list = state.trialFilter === 'all' ? t.items
    : state.trialFilter === 'chinadrugtrials' ? t.items.filter(i => i.source.includes('登记平台'))
    : [];
  const fields = matchProfileFields();
  const missing = fields.filter((f) => !f.v);
  return `<div class="card"><div class="card-head"><h2>入组档案（不重复录入）</h2><span class="muted">完整度 ${fields.length - missing.length}/${fields.length} · 全部来自既有病情数据</span></div>
    <div class="notice">缺失不阻断匹配，但对应条件为「无法自动匹配」${missing.length ? '，当前缺失：' + missing.map((f) => esc(f.k)).join(' · ') : ''}。</div>
    <div class="rows">${fields.map((f) => row(esc(f.k), f.v ? `${esc(f.v)} · 来源：${esc(f.src)}` : '<b>未记录</b>——对应条件为「无法自动匹配」')).join('')}</div>
    <p class="muted small">年龄 / 末次妊娠 / FIGO 八项 / 化疗方案等已在诊断与治疗页维护，这里只读不录；补充字段请回对应业务页录入。</p>
  </div>
  <div class="card"><div class="card-head"><h2>检索双通道</h2><span class="muted">自带库 6 条 · AI 协助只起草不代发</span></div>
    <div class="rows">
      ${row('① 自带库检索', `${esc(t.sourceLabel)} · 快照 2026-10-25 · ${t.items.length} 条登记摘录（下方按来源筛选）`)}
      ${row('② AI 协助匹配', '把档案摘要与试验列表预写进提示词（gtn:agent-draft 契约：只填充输入框，不自动发送）', `<button class="text-button" data-action="agent-draft" data-prompt="${esc(matchPrompt())}">AI 协助匹配</button>`)}
      ${row('外部检索通道', '脚本 fetch-gtn-trials-2026（终端态如实：需在终端手动运行，本页不代跑）· unified-trial-mcp（开发版未接入）', pill('未接入', 'yellow'))}
    </div>
    <div class="chip-row" role="group" aria-label="按来源筛选">${filters.map(([k, l]) =>
      `<button class="chip${state.trialFilter === k ? ' on' : ''}" data-action="trial-filter" data-arg="${k}" aria-pressed="${state.trialFilter === k}">${l}</button>`).join('')}</div>
    ${list.length ? list.map(i => `<div class="cand">
      <div class="cand-head"><b>${esc(i.title)}</b>${pill(i.status, 'yellow')}</div>
      <div class="cand-fields">
        <span><i>登记号</i><b>${esc(i.recordId)}</b></span>
        <span><i>申办方</i><b>${esc(i.sponsor)}</b></span>
        <span><i>来源</i><b>${esc(i.source)}</b></span>
      </div>
      <p class="muted small">登记 ≠ 有效 ≠ 可入组；详情与参与条件请以登记平台原文及研究方答复为准：${esc(i.url)}</p>
    </div>`).join('') : emptyBox('没有匹配的登记条目', '换一个来源筛选试试；「其它来源」在当前快照里为空，如实显示空态。')}
  </div>
  <div class="card"><div class="card-head"><h2>匹配结果（三档 · 固定格式）</h2><span class="muted">确定性规则求值 · 排序按数据来源顺序</span></div>
    <div class="notice">每张卡按「结构化命中 / 文本命中 / 宽口径命中 / 无法自动匹配」分层陈列条件原文、你的记录与来源；不输出数值综合分、不排序择优、不写「你不适合/你能入组」。${esc(D.match.channelsNote)}</div>
    <div class="rows">${D.match.entries.slice().sort((a, b) => (BAND_ORDER[matchBand(a).band[0]] ?? 9) - (BAND_ORDER[matchBand(b).band[0]] ?? 9)).map(matchResultCard).join('')}</div>
    <p class="muted small">粗筛符合度 = 符合项 ÷ 已对照项，无法自动匹配按 0 计（只会偏低、不会偏高）；分层层内保持登记来源顺序。这不是入组资格，也不代表任何效果预期。</p>
    <p class="muted small">${esc(D.match.footerNote)}</p>
  </div>
  ${agentPane(matchPrompt())}
  ${quoteLine(QUOTE.none)}`;
}

/* 检索子页：筛条件（试验特征），与「匹配」（用你的记录）分开——biliary 式结构。 */
function vTrialsSearch() {
  const t = D.trials;
  const scene = state.trialScene || 'all';
  const statusF = state.trialStatus || 'all';
  const bySource = state.trialFilter || 'all';
  let list = t.items;
  if (bySource === 'chinadrugtrials') list = list.filter(i => i.source.includes('登记平台'));
  else if (bySource === 'other') list = [];
  const scenes = [['all', '不限'], ['chemo', '化疗期语境'], ['followup', '随访期语境']];
  const statuses = [['all', '不限状态'], ...[...new Set(t.items.map(i => i.status))].map(x => [x, x])];
  return `<div class="card"><div class="card-head"><h2>筛条件</h2><span class="muted">试验特征筛选；「与我相关」的判断在「匹配」子页，两者分开</span></div>
    <div class="chip-row" role="group" aria-label="治疗场景">${scenes.map(([k, l]) => `<button class="chip${scene === k ? ' on' : ''}" data-action="trial-scene" data-arg="${k}" aria-pressed="${scene === k}">${l}</button>`).join('')}</div>
    <div class="chip-row" role="group" aria-label="登记状态">${statuses.map(([k, l]) => `<button class="chip${statusF === k ? ' on' : ''}" data-action="trial-statusf" data-arg="${esc(k)}" aria-pressed="${statusF === k}">${esc(l)}</button>`).join('')}</div>
    <div class="chip-row" role="group" aria-label="按来源筛选">${[['all', '全部来源'], ['chinadrugtrials', '中国药物临床试验登记平台'], ['other', '其它来源（演示空态）']].map(([k, l]) => `<button class="chip${bySource === k ? ' on' : ''}" data-action="trial-filter" data-arg="${k}" aria-pressed="${bySource === k}">${l}</button>`).join('')}</div>
    <div class="rows">${list.length ? list.map(i => `<div class="cand">
      <div class="cand-head"><b>${esc(i.title)}</b>${pill(i.status, 'yellow')}</div>
      <div class="cand-fields"><span><i>登记号</i><b>${esc(i.recordId)}</b></span><span><i>申办方</i><b>${esc(i.sponsor)}</b></span><span><i>来源</i><b>${esc(i.source)}</b></span></div>
      <p class="muted small">登记 ≠ 有效 ≠ 可入组；详情以登记平台原文为准：${esc(i.url)}</p>
    </div>`).join('') : emptyBox('没有匹配的登记条目', '换一组筛选试试；「其它来源」在当前快照里为空，如实显示空态。')}</div>
    <p class="muted small">检索只按条目本身筛选；「与我相关」的判断在匹配子页，用的是你的当前记录——两者分开，是为了让你能看见「与我无关但存在」的选项。</p>
  </div>
  ${agentPane('请帮我把检索子页的试验按登记状态整理成清单（登记号 / 标题 / 状态 / 来源），保持原文不改写，不加任何入组相关判断。')}
  ${quoteLine(QUOTE.none)}`;
}

/* 收藏跟踪子页：跟踪「试验变了什么」，不是「我该不该进」。 */
function vTrialsFollow() {
  const favs = [...state.trialFavs];
  const items = favs.map(id => D.trials.items.find(i => i.recordId === id)).filter(Boolean);
  const entries = favs.map(id => D.match.entries.find(e => e.recordId === id)).filter(Boolean);
  return `<div class="card"><div class="card-head"><h2>收藏与跟踪（${favs.length}）</h2><span class="muted">跟踪的是「试验变了什么」，不是「我该不该进」</span></div>
    ${items.length ? `<div class="rows">${items.map((i, n) => row(`${esc(i.recordId)} · ${esc(i.title)}`,
      `状态：${esc(i.status)} · 来源：${esc(i.source)} · 快照 2026-10-25；${entries[n] ? `最近分层评估 ${esc(D.match.generatedAt.slice(0, 10))}（档案 ${esc(D.match.profileRevision)}）` : '尚未评估'}；登记状态有变时以平台原文为准，本页不自动推送`,
      pill('跟踪中', 'grey'))).join('')}</div>
    <p class="muted small">快照会过期：状态与条件以登记平台当前原文为准；重新运行 fetch-gtn-trials-2026 可刷新本地快照（终端态如实）。</p>`
    : emptyBox('还没有收藏的试验', '在「匹配」子页点 ☆ 收藏，这里才会出现跟踪线。')}
  </div>
  ${agentPane('请帮我把收藏的试验整理成复诊时要问的研究问题清单（登记号 / 我想问什么），只整理问题不写答案，不做任何入组判断。')}
  ${quoteLine(QUOTE.none)}`;
}

const VIEWS = { dashboard: vDashboard, hcg: vHcg, treatment: vTreatment, diagnosis: vDiagnosis, followup: vFollowup, oneshow: vOneshow, nutrition: vNutrition, mind: vMind, trials: vTrials, import: vImport, review: vReview, settings: vSettings };

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
function formAddMetricPoint(key) {
  const s = (D.metrics ? D.metrics.series : []).find((x) => x.key === key);
  if (!s) { toast('该序列暂不支持在此补录（血 hCG 请回「血 hCG」页签，体重请去营养支持页）。'); return; }
  openDialog(`手工补录一个值 · ${s.name}（4 字段）`,
    `<div class="form">
      <label>日期<input name="d" value="2026-10-25" placeholder="YYYY-MM-DD"></label>
      <label>数值<input name="v" data-keypad data-label="${esc(s.name)}数值" inputmode="decimal" placeholder="点此用数字键盘"></label>
      <label>单位（照抄化验单原文）<input name="u" value="${esc(s.unit)}"></label>
      <label>来源<input name="src" value="${esc(s.source)}"></label>
    </div>
    <div class="notice">数值照抄原文；更正一个已入档的值=「改这一条」新增版本，旧值进版本链。</div>`,
    `<button data-action="save-metric-point" data-key="${esc(key)}">保存</button><button class="soft" data-action="close">取消</button>`);
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
function formAddMood(kind) {
  const isWait = kind === 'wait';
  openDialog(isWait ? '记一个等报告日（3 字段）' : '写一条情绪记录（3 字段）',
    `<div class="form">
      <label>日期<input name="d" value="2026-10-25"></label>
      ${isWait ? '' : `<label>情绪三态（单选）
        <div class="score-row">${Object.entries(MOOD_LABEL).map(([k, l]) =>
          `<button type="button" class="chip on-mood" data-action="mood-pick" data-k="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
        <input type="hidden" name="state" value="flat"></label>`}
      <label>${isWait ? '那天是什么样<input name="text" placeholder="如：反复看手机，饭也没心思做"></label>' : '想写一句什么<input name="text" placeholder="一句就行，可以只写几个字"></label>'}
      ${isWait ? `<label>当时怎么撑过去的<input name="cope" placeholder="如：提前约了妈妈陪"></label>` : ''}
    </div>
    <div class="notice">私密记录（is_private）：仅本机保存，不进复诊材料与 AI 上下文。</div>`,
    `<button data-action="save-${kind}">保存</button><button class="soft" data-action="close">取消</button>`);
  document.querySelectorAll('.on-mood').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.on-mood').forEach(x => { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
    $('#dialog-body [name="state"]').value = b.dataset.k;
  }));
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
  /* 宿主形态：同时把草稿递给外壳的 DSH 原生会话（只填入，不代发——IP10 同款守卫）。 */
  if (window.parent !== window) {
    try { window.parent.postMessage({ type: 'gtn:agent-draft', prompt: promptText }, window.location.origin); } catch { /* 外壳收不到时留在本页输入框 */ }
  }
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
  /* AI 会话外壳（开发版）：开合只切显隐，不结束/删除会话 */
  'agent-toggle'() {
    if (agentDock.state === 'unavailable') { toast('AI 对话暂不可用：当前是独立启动（没有 DSH 原生会话）。装进 Desktop 后顶栏即可调起。'); return; }
    if (window.parent !== window) {
      try { window.parent.postMessage({ type: 'gtn:agent-toggle' }, window.location.origin); } catch { /* 宿主收不到时按本地态走 */ }
      agentPaneApply(agentDock.state === 'open' ? 'collapsed' : 'idle');
      return;
    }
    agentPaneApply(agentDock.state === 'open' ? 'collapsed' : 'unavailable');
  },
  'agent-hide'() { agentPaneApply('collapsed'); },
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
  /* 检查与指标：二级页签 / 序列显隐 / 手工补录 / AI 导入候选 */
  'metric-tab'(el) { state.metricTab = el.dataset.arg || 'bhcg'; render(); },
  'metric-toggle'(el) {
    const k = el.dataset.arg;
    if (state.metricHidden.has(k)) state.metricHidden.delete(k);
    else state.metricHidden.add(k);
    render();
    toast(state.metricHidden.has(k) ? '该序列已隐藏（只是不画线，记录都还在）。' : '该序列已恢复显示。');
  },
  'metric-add'(el) { formAddMetricPoint(el.dataset.arg); },
  'save-metric-point'(el) {
    const key = el.dataset.key;
    const s = D.metrics.series.find((x) => x.key === key);
    const g = (n) => $(`#dialog-body [name="${n}"]`).value.trim();
    if (s) {
      s.points.push({ d: g('d') || '2026-10-25', v: Number(g('v')) || 0 });
      s.points.sort((a, b) => (a.d < b.d ? -1 : 1));
      if (g('src')) s.source = g('src');
    }
    closeDialog(); render(); toast('指标记录 +1（数字键盘手工通道）；曲线已更新。');
  },
  'metric-ai-cand'(el) {
    const s = D.metrics.series.find((x) => x.key === el.dataset.arg);
    D.imports.candidates.push({ id: uid('C'), file: `${s ? s.name : '指标'}化验单_AI候选.jpg`, authorized: false, unverified: true, status: 'pending',
      fields: { '指标': s ? s.name : '', '日期': '2026-10-25', '数值': '', '单位': s ? s.unit : '', '医院': '市一医院' } });
    render(); toast('AI 导入候选已生成（gtn:agent-draft 契约：只起草不代发）；候选在核对区，核对前不入事实层。');
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
  /* 指标分类 3D 卡翻转（点击 / 回车 / 空格均走按钮 click） */
  flip(el) {
    const key = el.dataset.key;
    if (state.flipped.has(key)) state.flipped.delete(key);
    else state.flipped.add(key);
    el.setAttribute('aria-pressed', state.flipped.has(key) ? 'true' : 'false');
  },
  /* 营养 */
  'add-meal'() {
    openDialog('手工记一餐（≤6 字段）',
      `<div class="form">
        <label>日期<input name="d" value="2026-10-25"></label>
        <label>餐次<input name="meal" value="午餐" placeholder="早餐 / 午餐 / 晚餐 / 加餐"></label>
        <label>吃了什么<input name="intake" placeholder="如：软面条 1 碗 + 蒸蛋"></label>
        <label>口腔情况<input name="ulcer" value="无溃疡记录" placeholder="如：有溃疡，烫的吃不了"></label>
        <label>叶酸（照医嘱原文）<input name="folate" placeholder="只照医嘱记录，不写建议"></label>
      </div>
      <div class="notice">口腔情况按你的自述记录影响；叶酸补充与否、剂量与时机只照医嘱原文。</div>`,
      `<button data-action="save-meal">保存</button><button class="soft" data-action="close">取消</button>`);
  },
  'save-meal'() {
    const g = (n) => $(`#dialog-body [name="${n}"]`).value.trim();
    const ulcer = g('ulcer');
    D.nutrition.meals.push({ d: g('d') || '2026-10-25', meal: g('meal') || '加餐', intake: g('intake'), ulcer: ulcer.includes('溃疡') && !ulcer.includes('无') ? '有' : '无', ulcerNote: ulcer, folate: g('folate') || '未填' });
    closeDialog(); render(); toast('饮食记录 +1（手工通道）；AI 候选默认收在「⋯ 更多」里。');
  },
  'ai-meal-cand'() { toast('AI 拍餐盘出候选（演示）：候选卡出现在核对区，逐项核对后才入档。'); },
  /* 心理 */
  'add-mood'() { formAddMood('mood'); },
  'add-wait'() { formAddMood('wait'); },
  'mood-pick'() { /* 三态选择在 formAddMood 内联绑定处理 */ },
  'save-mood'() {
    const g = (n) => $(`#dialog-body [name="${n}"]`).value.trim();
    D.mind.moods.push({ d: g('d') || '2026-10-25', state: g('state') || 'flat', text: g('text') });
    closeDialog(); render(); toast('情绪记录 +1 · 私密仅本机，不进任何导出。');
  },
  'save-wait'() {
    const g = (n) => $(`#dialog-body [name="${n}"]`).value.trim();
    D.mind.waitDays.push({ d: g('d') || '2026-10-25', text: g('text'), cope: g('cope') || '（未写）' });
    closeDialog(); render(); toast('等报告日记录 +1 · 私密仅本机。');
  },
  /* 临床研究 */
  'trial-filter'(el) { state.trialFilter = el.dataset.arg; render(); },
  'trial-sub'(el) { state.trialSub = el.dataset.arg; render(); },
  'trial-scene'(el) { state.trialScene = el.dataset.arg; render(); },
  'trial-statusf'(el) { state.trialStatus = el.dataset.arg; render(); },
  'oc-range'(el) { state.oneshow.range = el.dataset.arg; render(); },
  'oc-toggle'(el) { const k = el.dataset.arg; state.oneshow.toggles[k] = !state.oneshow.toggles[k]; render(); },
  'oc-pin'(el) { if (el.dataset.arg) { state.oneshow.pin = el.dataset.arg; render(); } },
  'oc-unpin'() { state.oneshow.pin = null; render(); },
  'trial-fav'(el) {
    const id = el.dataset.arg;
    if (state.trialFavs.has(id)) state.trialFavs.delete(id);
    else state.trialFavs.add(id);
    render(); toast(state.trialFavs.has(id) ? '已加入收藏（仅本机演示态，登记详情以平台原文为准）。' : '已取消收藏。');
  },
  /* 键盘 */
  key(el) { keypadKey(el.dataset.k); },
  'key-ok'() { if (state.keypad && state.keypad.input) state.keypad.input.value = $('#keypad-screen').value; closeDialog(); },
  close() { closeDialog(); },
  'disease-brief'() { diseaseBriefDialog(); },
  /* 「和 AI 讨论」：拉起对话栏 + 携带本页关键信息（填入不代发）；再次点击对话栏不收起（收起走顶栏五态开关） */
  discuss() {
    const draftBtn = document.querySelector('.agent-card [data-action="agent-draft"]');
    const base = draftBtn ? draftBtn.dataset.prompt : '请帮我整理当前页面的记录。';
    const title = (PAGES.find(x => x[0] === state.view) || [])[1] ?? '';
    agentDraft(`【${title} · 本页关键信息】${discussFacts()}\n\n${base}`);
    agentPaneApply('open');
    document.querySelector('#agent-dock')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },
  'discuss-brief'() {
    closeDialog();
    agentDraft(`【GTN 疾病概要 · 讨论】我正在看疾病概要：指南以 NCCN 2.2026 / FIGO 2000 评分 / 中华医学会 2021 为出处。请用通俗的话解释其中我不懂的部分（比如 FIGO 评分八个项目分别是什么意思），只做概念解释，不针对我的病情做任何判断。`);
    agentPaneApply('open');
    document.querySelector('#agent-dock')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
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
  const oc = e.target.closest('input[data-oc-metric]');
  if (oc) {
    const id = oc.dataset.ocMetric;
    if (oc.checked) { if (state.oneshow.sel.length >= 4) { oc.checked = false; toast('最多同时看 4 个指标，先取消一个再选。'); return; } if (!state.oneshow.sel.includes(id)) state.oneshow.sel.push(id); }
    else state.oneshow.sel = state.oneshow.sel.filter(x => x !== id);
    state.oneshow.pin = null; render();
  }
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

/* ---------------- AI 会话面板外壳（开发版法定新增：顶栏五态 + 拖宽 + 收起） ----------------
   五态：AI 对话 / 正在连接… / 收起 AI 对话 / 打开 AI 对话 / AI 对话暂不可用。
   宿主形态（window.parent !== window）由 lib/client.js 的原生会话接管，页面只听状态消息；
   独立启动没有原生会话，如实显示「暂不可用」，不自建聊天框兜底。
   收起只切 paneOpen 与 display，不调用任何 close/delete；宽度存 localStorage，读回过 clamp。 */
const AGENT_WIDTH_KEY = 'grapal.gtn.agent-pane.v1';
const AGENT_LABELS = {
  idle: 'AI 对话', connecting: '正在连接…', open: '收起 AI 对话',
  collapsed: '打开 AI 对话', unavailable: 'AI 对话暂不可用'
};
const agentDock = { state: 'unavailable', width: 0.35, min: 0.25, max: 0.45, step: 0.02 };

function agentPaneApply(stateName, note) {
  agentDock.state = stateName;
  const btn = $('#agent-toggle'), label = $('#agent-label');
  const dock = $('#agent-dock'), splitter = $('#agent-splitter');
  if (!btn || !label) return;
  btn.dataset.state = stateName;
  const text = AGENT_LABELS[stateName] || 'AI 对话';
  label.textContent = text;
  btn.setAttribute('aria-label', `AI 对话：${text}`);
  const show = stateName === 'open' || stateName === 'connecting';
  btn.setAttribute('aria-expanded', String(show));
  if (dock) dock.hidden = !show;
  if (splitter) splitter.hidden = stateName !== 'open';
  const n = $('#agent-note');
  if (n) n.textContent = note || '';
  if (stateName === 'unavailable') {
    const body = $('#agent-body');
    if (body) body.innerHTML = '<p>当前环境没有 DSH 原生会话（独立启动不自带聊天服务）。</p><p>装进 DSH Desktop 后，顶栏「AI 对话」会调起原生会话；业务页的记录与整理不依赖会话，照常可用。</p>';
  }
}

function agentWidthApply(w) {
  const clamped = Math.min(agentDock.max, Math.max(agentDock.min, w));
  agentDock.width = Math.round(clamped * 10000) / 10000;
  const dock = $('#agent-dock'), splitter = $('#agent-splitter');
  const pct = Math.round(agentDock.width * 100);
  if (dock) dock.style.flexBasis = `${pct}%`;
  if (splitter) splitter.setAttribute('aria-valuenow', String(pct));
  try { localStorage.setItem(AGENT_WIDTH_KEY, JSON.stringify({ width: agentDock.width })); } catch { /* 隐私模式忽略 */ }
}

/** splitter 拖动四条：容器 rect 夹取 / role=separator / 键盘同精度 / localStorage 过 clamp。 */
function agentShellWire() {
  const btn = $('#agent-toggle'), splitter = $('#agent-splitter');
  if (!btn || !splitter) return;
  try { const saved = JSON.parse(localStorage.getItem(AGENT_WIDTH_KEY) || 'null'); if (saved && Number.isFinite(saved.width)) agentWidthApply(saved.width); } catch { /* 坏值忽略 */ }

  /* 开合走 document 委托（data-action="agent-toggle"/"agent-hide"），这里不再绑第二份。 */
  let host = null;
  splitter.addEventListener('pointerdown', (e) => { e.preventDefault(); host = $('#work-grid'); splitter.setPointerCapture(e.pointerId); });
  splitter.addEventListener('pointermove', (e) => {
    if (!host) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width) return;
    agentWidthApply((rect.right - e.clientX) / rect.width);   // 会话在右：指针越靠左越宽
  });
  splitter.addEventListener('pointerup', () => { host = null; });
  splitter.addEventListener('keydown', (e) => {
    const delta = { ArrowLeft: agentDock.step, ArrowRight: -agentDock.step }[e.key];
    if (delta !== undefined) { e.preventDefault(); agentWidthApply(agentDock.width + delta); return; }
    if (e.key === 'Home') { e.preventDefault(); agentWidthApply(agentDock.max); }
    if (e.key === 'End') { e.preventDefault(); agentWidthApply(agentDock.min); }
  });

  if (window.parent !== window) {
    /* 宿主形态：状态由外壳（lib/client.js）推送；页面只上报开合意图，不自建会话。 */
    agentPaneApply('idle');
    window.addEventListener('message', (e) => {
      if (e.origin !== window.location.origin) return;
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'gtn:agent-state' && AGENT_LABELS[msg.state]) agentPaneApply(msg.state, msg.note || '');
    });
  } else {
    agentPaneApply('unavailable');
  }
}

/* ---------------- 设置页凭据状态同步（来自 /api/gtn/settings/mineru，不收集真实密钥） ---------------- */
async function syncCredStatus() {
  try {
    const res = await fetch(`${apiBase()}/api/gtn/settings/mineru`, { headers: { accept: 'application/json' }, credentials: 'same-origin' });
    if (!res.ok) return;
    const st = await res.json();
    D.settings.cred = {
      source: st.sourceLabel || '本机密钥文件',
      status: st.configured ? `已配置（${st.masked}）` : (st.sourceLabel || '尚未配置')
    };
    if (st.error) D.settings.cred.status = `${D.settings.cred.status} · ${st.error}`;
  } catch { /* 掉线时保留回退文案，不报错 */ }
}

/* ---------------- 启动（异步化：先拿数据再渲染，失败渲染横幅，禁止裸 throw） ---------------- */
async function init() {
  agentShellWire();
  const base = apiBase();
  if (apiBaseInvalid(base)) {
    showBanner('error', `<b>接口基址校验失败。</b>当前挂载前缀「${esc(base)}」以 /api 结尾，与页面的 /api/gtn 拼接会产生 /api/api 重复。请在宿主里换一个挂载前缀；页面保持离线演示数据，不会白屏。`);
    DATA_SOURCE = 'demo';
  } else {
    const { reachable, payload } = await loadBootstrap();
    if (reachable && payload) {
      applyData(payload);
      DATA_SOURCE = 'api';
      showBanner('info', `<b>已连接本机资料库。</b>数据来自你选定的资料目录；演示档案（林小葡）仅在空库时播种一次。`);
      void syncCredStatus();
    } else {
      DATA_SOURCE = 'demo';
      showBanner('warn', '<b>离线演示数据。</b>本机服务（/api/gtn/bootstrap）没有应答：如果这是静态打开或服务未启动，看到的是演示档案，改动不会保存。');
    }
  }
  render();
}
init();

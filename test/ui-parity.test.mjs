/* 逐视图 parity：public/ 与 prototypes/v0.6/（v0.6.0 十二页原型（疾病概要 ? 入口随签），签认基准）必须是
 * 「同一份渲染代码，只换数据来源」。
 *
 * 钉五件事：
 * 1. 原型里的每个函数在开发版里都存在（不许删视图/删交互）；
 * 2. 开发版新增的函数只能是数据层 / 启动 / AI 会话外壳那一组（白名单），不许偷偷加视图；
 * 3. 导航与文案常量（PAGES / SUBTITLES / QUOTE / ENTRY_* / EVENT_LABEL / MOOD_LABEL）逐字一致；
 * 4. style.css 逐字节一致（开发版外壳样式全在 shell.css，不许碰视觉基准）；
 * 5. index.html 只差法定项：版本字面量（归一化）、原型条文案、外壳新增节点
 *    （noindex / shell.css / data-banner / work-grid / agent 五态 + splitter + dock）。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const proto = read('prototypes/v0.6/app.js');
const shipped = read('public/app.js');

/** 从源码里抠出一个 `const X = ...;` 常量块（到行尾分号；原型与开发版同形，够用）。 */
function block(src, name) {
  const i = src.indexOf(`const ${name} = `);
  assert.notEqual(i, -1, `找不到常量 ${name}`);
  const end = src.indexOf(';\n', i);
  return src.slice(i, (end === -1 ? src.length : end) + 2);
}

const fnNames = (src) => [...src.matchAll(/function ([A-Za-z_$][\w$]*)/g)].map((m) => m[1]).sort();

test('① 视图函数：原型里的每个函数开发版都有（一个都不许丢）', () => {
  const shippedSet = new Set(fnNames(shipped));
  const missing = fnNames(proto).filter((n) => !shippedSet.has(n));
  assert.deepEqual(missing, [], `开发版缺少这些函数：${missing.join(', ')}`);
});

test('② 新增函数只能是数据层 / 启动 / AI 会话外壳组（防止偷偷另写一套视图）', () => {
  const ALLOWED = new Set([
    'apiBase', 'apiBaseInvalid', 'loadBootstrap', 'showBanner', 'applyData',
    'agentPaneApply', 'agentWidthApply', 'agentShellWire', 'syncCredStatus', 'init',
  ]);
  const protoSet = new Set(fnNames(proto));
  const extra = fnNames(shipped).filter((n) => !protoSet.has(n) && !ALLOWED.has(n));
  assert.deepEqual(extra, [], `开发版多出未登记的函数：${extra.join(', ')}（要加就先想清楚是不是在另写视图）`);
});

test('③ 12 个一级页与文案常量：两边逐字一致', () => {
  for (const name of ['PAGES', 'SUBTITLES', 'QUOTE', 'EVENT_LABEL', 'MOOD_LABEL']) {
    assert.equal(block(shipped, name), block(proto, name), `${name} 与原型不一致`);
  }
  for (const name of ['ENTRY_P1', 'ENTRY_P2', 'ENTRY_P3', 'ENTRY_P4', 'ENTRY_P5', 'ENTRY_P6', 'ENTRY_P8', 'ENTRY_P9', 'ENTRY_P10']) {
    const p = proto.match(new RegExp(`const ${name} = '([^']+)'`));
    const s = shipped.match(new RegExp(`const ${name} = '([^']+)'`));
    assert.equal(s?.[1], p?.[1], `${name} 必须与原型逐字一致`);
  }
  /* 只数 PAGES 常量块里的页键（chip 定义 / 勾选清单也是 ['k','v'] 形，不能混进来） */
  const pages = [...block(proto, 'PAGES').matchAll(/\['([a-z]+)',/g)].map((m) => m[1]);
  assert.equal(pages.length, 12, `一级页必须 12 个，实际 ${pages.length}`);
  assert.equal(block(shipped, 'PAGES'), block(proto, 'PAGES'), 'PAGES 导航表逐字一致');
});

test('④ 样式表与原型逐字节一致（开发版外壳样式只进 shell.css）', () => {
  assert.equal(read('public/style.css'), read('prototypes/v0.6/style.css'),
    'style.css 与原型不一致；改视觉先改原型再同步，外壳样式去 shell.css');
});

test('⑤ index.html 只差法定项：版本归一化 + 原型条文案 + 外壳新增节点', () => {
  const strip = (html) => html
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/g, 'vX.Y.Z')
    .replace(/<div class="prototype-bar">.*<\/div>\n?/, '')            // 原型条：开发版改口径（本机库 vs 仅演示）
    .replace(/<meta name="robots"[^>]*><!--[^>]*-->\n?/, '')           // noindex：开发版法定新增
    .replace(/<link rel="stylesheet" href="shell.css">.*\n?/, '')       // shell.css：开发版法定新增
    .replace(/<div class="data-banner"[^>]*><\/div>\n?/, '')            // 数据来源横幅：法定新增
    .replace(/ {2}<button class="status" id="agent-toggle"[\s\S]*?<b id="agent-label">[^<]*<\/b><\/button>\n?/, '')  // AI 五态按钮
    .replace(/ {2}<div class="agent-splitter"[\s\S]*?hidden><\/div>\n?/, '')   // splitter（四条拖动规范在 app.js）
    .replace(/ {4}<aside class="agent-dock"[\s\S]*?<\/aside>\n?/, '')   // 会话 dock（恒定挂载，display 控显隐）
    .replace('<em id="app-build">', '<em>')                          // 版本 em 加 id：法定（bootstrap 回填版本）
    .replace(/<div class="work-grid" id="work-grid">\n?/, '')
    .replace(/\s*<\/div>\n(?=\s*<footer)/, '')   // work-grid 的收口 div：包裹层法定新增的另一半
    .replace(/<\/main>[^\n]*?(?=<footer)/, '</main>\n')             // 包裹层删除后 </main> 与 footer 拼行：拆回
    /* 外壳包裹层带来的行缩进差一并归零：结构性比对不受影响 */
    .replace(/^ +/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  const a = strip(read('public/index.html'));
  const b = strip(read('prototypes/v0.6/index.html'));
  if (a !== b) {
    const la = a.split('\n'), lb = b.split('\n');
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      if (la[i] !== lb[i]) { assert.fail(`index.html 第 ${i + 1} 行不一致：\n  开发版: ${la[i]}\n  原型:   ${lb[i]}`); }
    }
    assert.fail('index.html 与原型不一致');
  }
});

test('⑥ AI 五态：顶栏按钮五种文案齐全，收起不调 close/delete', () => {
  for (const label of ['AI 对话', '正在连接…', '收起 AI 对话', '打开 AI 对话', 'AI 对话暂不可用']) {
    assert.ok(shipped.includes(`'${label}'`) || shipped.includes(label), `五态文案缺「${label}」`);
  }
  assert.match(shipped, /AGENT_LABELS/, '五态映射表必须是常量');
  assert.match(read('public/index.html'), /id="agent-splitter" role="separator"/, 'splitter 必须带 role=separator');
  assert.match(read('public/index.html'), /id="agent-hide"/, '收起控件 #agent-hide 必须存在');
  assert.match(read('public/index.html'), /id="agent-label"/, '状态标签 #agent-label 必须存在');
  /* 收起只切显隐：外壳代码里不许出现结束/删除会话的调用 */
  const shellPart = shipped.slice(shipped.indexOf('AGENT_WIDTH_KEY'));
  assert.equal(/\.close\(|\.delete\(/.test(shellPart), false, '收起不许调用 close/delete');
});

test('⑦ 前缀同源：页面只认 /api/gtn，且由 routes.js 唯一定义', () => {
  assert.match(shipped, /\/api\/gtn\/bootstrap/, 'Bootstrap 路径必须显式写出');
  assert.match(shipped, /\/api\/gtn\/ui/, 'apiBase 从页面自身的 /api/gtn/ui 路径反推挂载前缀');
  assert.equal((shipped.match(/\/api\/gtn/g) || []).length >= 2, true);
  const routes = read('dsh/routes.js');
  assert.match(routes, /export const API_PREFIX = '\/api\/gtn'/, '唯一来源在 dsh/routes.js');
  /* 页面里不许再出现第二个前缀写法（如 /api/gtn2、写死 host） */
  assert.equal(/api\/[a-z]+\/bootstrap/.test(shipped.replace(/api\/gtn\/bootstrap/g, '')), false);
});

/* apiBase 定稿契约（v0.1.3）双形态回归 + 交界守卫 + 禁裸 throw。
 *
 * 契约：API_BASE = 挂载前缀（独立启动空串，宿主 /api/gtn 形态），页面统一拼
 * `${API_BASE}/api/gtn/xxx`；守卫只禁交界重复 /api/api（/(^|/)api$/），
 * 不许 includes('/api') 一刀切——宿主前缀含 /api 是允许的形态。
 * 启动期校验失败必须渲染错误横幅，禁止裸 throw 白屏。
 *
 * 做法：从 public/app.js 源码里抠出 apiBase()/apiBaseInvalid() 与 init 的骨架，
 * 在注入的 location/fetch 沙箱里分别跑「空串」与「/api/gtn 深挂载」两个形态。
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const appSrc = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

function extractFn(name) {
  const m = appSrc.match(new RegExp(`function ${name}\\(([\\s\\S]*?)\\n}`));
  assert.ok(m, `public/app.js 里必须有 function ${name}`);
  return m[0];
}

/* 把抠出的函数体放进沙箱求值：apiBase 依赖注入的 location，apiBaseInvalid 是纯函数。 */
const apiBase = (loc) => new Function('location', `${extractFn('apiBase')}; return apiBase(location);`)(loc);
const apiBaseInvalid = (base) => new Function('base', `${extractFn('apiBaseInvalid')}; return apiBaseInvalid(base);`)(base);

test('① 双形态回归：独立启动（空串前缀）', () => {
  /* 独立启动：页面挂在站点根（dev-server 直接伺服 public/），API_BASE = '' */
  const base = apiBase({ pathname: '/index.html' });
  assert.equal(base, '', '根挂载的前缀必须是空串');
  assert.equal(`${base}/api/gtn/bootstrap`, '/api/gtn/bootstrap');
  assert.equal(apiBaseInvalid(base), false, '空串合法');
});

test('② 双形态回归：宿主 /api/gtn 形态（ui 挂在 /api/gtn/ui/ 下）', () => {
  const base = apiBase({ pathname: '/api/gtn/ui/index.html' });
  assert.equal(base, '', '/api/gtn/ui 在站点根下 → 前缀空串，请求 /api/gtn/bootstrap');
  assert.equal(apiBaseInvalid(base), false);

  /* 宿主再套一层挂载前缀（如 /workbench/api/gtn/ui/）→ 前缀 /workbench */
  const deep = apiBase({ pathname: '/workbench/api/gtn/ui/' });
  assert.equal(deep, '/workbench');
  assert.equal(`${deep}/api/gtn/bootstrap`, '/workbench/api/gtn/bootstrap');
  assert.equal(apiBaseInvalid(deep), false, '前缀含 /api 是允许形态，不许一刀切');

  /* 前缀本身就叫 /api/gtn（宿主挂载名恰好是它）→ 拼接结果 /api/gtn/api/gtn/...，
     宿主按 prefix=/api/gtn 转发后落到 /api/gtn/...，合法 */
  const mount = apiBase({ pathname: '/api/gtn/api/gtn/ui/' });
  assert.equal(mount, '/api/gtn');
  assert.equal(apiBaseInvalid(mount), false, '/api/gtn 结尾是 gtn，不是 api，合法');
});

test('③ 交界守卫：只禁 /(\\^|\\/)api$/——前缀以 /api 结尾才报', () => {
  assert.equal(apiBaseInvalid(''), false, '空串合法');
  assert.equal(apiBaseInvalid('/api'), true, '/api 结尾会产生 /api/api，必须报');
  assert.equal(apiBaseInvalid('/foo/api'), true);
  assert.equal(apiBaseInvalid('/api/gtn'), false, '含 /api 但不以 api 结尾：合法（不许 includes 一刀切）');
  assert.equal(apiBaseInvalid('/prefix/api/gtn'), false);
  /* 守卫实现必须是词尾正则（/(^|\/)api$/），不是 includes('/api') 一刀切 */
  assert.match(appSrc, /\(\^\|\\\/\)api\$/, '守卫必须按词尾正则匹配，不许 includes(\'/api\')');
});

test('④ 禁裸 throw：启动路径校验失败渲染横幅，不抛异常', async () => {
  /* init 骨架里唯一允许的 throw 是……没有：源码断言 init/applyData/apiBase 不含 throw */
  for (const name of ['apiBase', 'loadBootstrap', 'showBanner', 'applyData', 'init']) {
    const fn = extractFn(name);
    assert.equal(/\bthrow\b/.test(fn), false, `${name} 里不许出现 throw（校验失败走错误横幅，不白屏）`);
  }
  /* init 的校验分支必须调用 showBanner（错误横幅）而不是中断 */
  assert.match(appSrc, /apiBaseInvalid\(base\)[\s\S]{0,400}showBanner\('error'/, '交界校验失败必须渲染 error 横幅');
  /* fetch 失败同样走横幅 + 回退演示数据，不抛 */
  assert.match(appSrc, /DATA_SOURCE = 'demo';\s*\n\s*showBanner\('warn'/, '掉线要走 warn 横幅回退');
});

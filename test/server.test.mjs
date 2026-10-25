/* HTTP 层：健康检查 / bootstrap / 静态文件 / 未知接口 JSON 404 / 路径穿越拦截 /
   MinerU 设置状态（不含 token 原文）/ 候选核对（拒收零副作用）/ 资料目录校验。
 *
 * 起真实服务（port:0 由系统分配），只用内置 fetch。测完必须关 server 与 db，
 * 否则 node --test 进程不退出。
 */

import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Workbench, validateWorkspacePath } from '../dsh/workbench.js';
import { startWorkbenchServer } from '../dsh/server.js';

const tmp = mkdtempSync(join(homedir(), '.xyb-gtn-server-'));
after(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* 清理失败不影响结果 */ } });

async function withServer(fn) {
  const workbench = await Workbench.open(join(tmp, 'workspace'));
  const { server, port, url } = await startWorkbenchServer({ port: 0, host: '127.0.0.1', workbench });
  try {
    await fn({ url, port, workbench });
  } finally {
    await new Promise((r) => server.close(r));
    workbench.close();
  }
}

test('① /api/gtn/health 返回 ok 与版本、目录', async () => {
  await withServer(async ({ url }) => {
    const r = await fetch(`${url}api/gtn/health`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.match(j.version, /^\d+\.\d+\.\d+/);
    assert.equal(j.ui, '/api/gtn/ui');
    assert.ok(j.dir && j.dir.includes('workspace'), '独立启动要下发资料目录（页面调起会话用）');
    assert.ok(j.capabilities.includes('import'), '能力清单要能看出装了哪些功能');
  });
});

test('② /api/gtn/bootstrap 返回与 demo-data.js 同形的档案', async () => {
  await withServer(async ({ url, workbench }) => {
    const r = await fetch(`${url}api/gtn/bootstrap`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.ok(j.data, 'bootstrap 必须带 data（单档案形状）');
    assert.equal(j.data.patient.name, '林小葡');
    assert.equal(j.data.hcg.points.length, 15);
    assert.equal(j.data.cycles.length, 3);
    assert.equal(j.data.trials.items.length, 6, '登记摘录 6 条');
    assert.equal(j.data.metricCats.length, 4, '指标分类卡 4 张');
    assert.equal(j.agent.available, true);
    assert.ok(j.layout.agentPane);
    assert.ok(j.data.settings.dir.includes('workspace'), '设置页目录 = 资料目录');
    /* 与读模型同源：直接比对 workbench.bootstrap() */
    assert.deepEqual(j, workbench.bootstrap());
  });
});

test('③ 静态 UI：/api/gtn/ui/ 回 index.html，路径穿越被拦', async () => {
  await withServer(async ({ url }) => {
    const page = await fetch(`${url}api/gtn/ui/`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /小葡宝 GraPal/);
    assert.match(html, /noindex/, '开发版页面必须带 noindex');

    const css = await fetch(`${url}api/gtn/ui/shell.css`);
    assert.equal(css.status, 200);

    /* 路径穿越：schema 冻结合同不在 public/ 下，必须拦住（回 index.html 或 4xx，不给文件内容） */
    const evil = await fetch(`${url}api/gtn/ui/..%2f..%2fpackage.json`);
    const body = await evil.text();
    assert.equal(body.includes('"peerDependencies"'), false, '穿越请求不许吐出 package.json 内容');
    const evil2 = await fetch(`${url}api/gtn/ui/../../../etc/passwd`);
    const body2 = await evil2.text();
    assert.equal(body2.includes('root:'), false, '系统文件不许读出');
  });
});

test('④ 未知 /api/* 回 JSON 404，不是 HTML', async () => {
  await withServer(async ({ url }) => {
    const r = await fetch(`${url}api/gtn/nope`);
    assert.equal(r.status, 404);
    assert.match(r.headers.get('content-type'), /application\/json/);
    const j = await r.json();
    assert.equal(j.error, 'not_found');
  });
});

test('⑤ MinerU 设置状态：GET 只给掩码与路径，不含 token 原文', async () => {
  await withServer(async ({ url }) => {
    const r = await fetch(`${url}api/gtn/settings/mineru`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.ok('configured' in j && 'sourceLabel' in j && 'masked' in j);
    assert.ok(!('token' in j), '状态接口不许出现 token 原文字段');
  });
});

test('⑥ 候选核对：accept/reject 只改状态；拒收零副作用', async () => {
  await withServer(async ({ url, workbench }) => {
    const before = workbench.db.prepare('SELECT id, status, filename FROM candidates ORDER BY rowid').all();
    assert.equal(before.length, 1);
    const id = before[0].id;

    const rej = await fetch(`${url}api/gtn/candidate/${id}/reject`, { method: 'POST' });
    assert.equal(rej.status, 200);
    assert.equal((await rej.json()).status, 'rejected');
    const afterReject = workbench.db.prepare('SELECT status, filename, fields_json FROM candidates WHERE id = ?').get(id);
    assert.equal(afterReject.status, 'rejected');
    assert.ok(afterReject.filename && afterReject.fields_json, '拒收不改候选原文（零副作用）');
    /* 事实层不受影响 */
    assert.equal(workbench.db.prepare('SELECT COUNT(*) AS n FROM hcg_rows').get().n, 16, '拒收不写 hCG 行');

    const acc = await fetch(`${url}api/gtn/candidate/${id}/accept`, { method: 'POST' });
    assert.equal(acc.status, 200);
    assert.equal(workbench.db.prepare('SELECT status FROM candidates WHERE id = ?').get(id).status, 'accepted');
  });
});

test('⑦ 资料目录校验：主目录/桌面/下载根/tmp 拒绝，不静默猜', () => {
  const home = homedir();
  assert.ok(validateWorkspacePath(home).length > 0, '主目录必须拒');
  assert.ok(validateWorkspacePath(join(home, 'Downloads')).length > 0, '下载根必须拒');
  assert.ok(validateWorkspacePath('/tmp').length > 0, '/tmp 必须拒');
  assert.ok(validateWorkspacePath('').length > 0, '空目录必须拒');
  assert.deepEqual(validateWorkspacePath(join(tmp, 'ok-dir')), [], '普通子目录可用');
});

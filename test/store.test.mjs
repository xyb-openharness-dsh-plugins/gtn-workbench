/* 数据层：迁移幂等 / 播种幂等 / 与 public/demo-data.js 的 parity / 读模型纪律。
 *
 * parity 是这一层最重要的断言：`/api/gtn/bootstrap` 的 data 必须与原型
 * public/demo-data.js（唯一数据源，v0.2.0 十二页版）逐字段一致。
 * settings 除外——它是"目录/解析模式/凭据"这类环境配置，服务端只回可定值。
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { openDatabase, migrate, close } from '../dsh/store.js';
import { seedDemo, hasDemoData, loadDemoData } from '../dsh/demo.js';
import { bootstrap, getProfile, listSubjects, figoTotal } from '../dsh/readmodels.js';
import { assertPanelConfig, PANEL, AGENT_PANE } from '../lib/layout.js';

const tmp = mkdtempSync(join(homedir(), '.xyb-gtn-test-'));
after(() => { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* 清理失败不影响结果 */ } });

/* demo-data.js 是浏览器脚本（window.DEMO_DATA = {...}）：用 dsh/demo.js 的同一加载器求值。 */
const DEMO = loadDemoData();

function seededDb() {
  const db = openDatabase(':memory:');
  migrate(db);
  seedDemo(db);
  return db;
}

test('① migrate 幂等：第二次执行不重跑已应用的迁移', () => {
  const db = openDatabase(':memory:');
  const first = migrate(db);
  const second = migrate(db);
  assert.deepEqual(first.executed, ['0001_initial.sql', '0002_dev.sql', '0003_dev2.sql', '0004_match.sql', '0005_metrics.sql'], '首次应执行 0001–0005');
  assert.deepEqual(second.executed, [], '第二次不应重跑');
  assert.equal(second.applied.length, 5);
  close(db);
});

test('② seedDemo 幂等：调两次只写一份档案', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const a = seedDemo(db);
  const b = seedDemo(db);
  assert.equal(a.skipped, false);
  assert.equal(a.subjects, 1);
  assert.equal(b.skipped, true, '第二次应整批跳过');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM subjects').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM hcg_rows').get().n, 16, '15 个点 + 1 条版本链旧行');
  close(db);
});

test('③ parity：库里读出的档案与 demo-data.js 逐字段一致（settings 除外）', () => {
  const db = seededDb();
  const p = getProfile(db, 'lin');
  const expect = { ...DEMO };
  delete expect.meta;
  delete expect.settings;
  const got = { ...p };
  delete got.settings;
  assert.deepStrictEqual(got, expect, 'getProfile 与 demo-data.js 不一致');
  const payload = bootstrap(db, { version: '0.3.0', build: 'test' });
  assert.equal(payload.version, '0.3.0');
  assert.equal(payload.agent.available, true, '开发版自带挂载位演示');
  assert.ok(payload.layout.agentPane, '布局常量要随 bootstrap 下发给前端');
  close(db);
});

test('④ 派生值不落库：FIGO 总分读取时求和，表内无总分列', () => {
  const db = seededDb();
  const p = getProfile(db, 'lin');
  assert.equal(p.figo.length, 8, 'FIGO 八项');
  assert.equal(figoTotal(p.figo), 4, '总分 = 0+0+0+2+1+0+1+0');
  const cols = db.prepare('PRAGMA table_info(figo_rows)').all().map((c) => c.name);
  assert.equal(cols.some((c) => /total|score_sum|grade/.test(c)), false, 'figo_rows 不许有总分/分级列');
  close(db);
});

test('⑤ hCG 版本链：in_use 行是现行值，旧行带 ver_at/ver_src 且可还原 versions', () => {
  const db = seededDb();
  const p = getProfile(db, 'lin');
  assert.equal(p.hcg.points.length, 15, '15 个数据点');
  const corrected = p.hcg.points.find((x) => x.versions);
  assert.ok(corrected, '2026-04-27 的点有版本链');
  assert.equal(corrected.d, '2026-04-27');
  assert.equal(corrected.v, 4260, '现行值取更正后的 4260');
  assert.deepEqual(corrected.versions.map((v) => v.v), ['4200', '4260']);
  /* 锚点（口径 B）：随访锚 = hCG 序列上 event_mark=anchor 的那行，不设"治愈日期"列 */
  const anchor = p.hcg.points.find((x) => x.event === 'anchor');
  assert.equal(anchor.d, '2026-06-22');
  assert.equal(p.followup.anchor, '2026-06-22', '随访锚点从 hCG 事件行推导');
  close(db);
});

test('⑥ ORDER BY rowid / 显式 NULL：未测不落 0，事件为空就是 null', () => {
  const db = seededDb();
  const p = getProfile(db, 'lin');
  for (const pt of p.hcg.points) {
    if (pt.d !== '2026-04-20' && pt.d !== '2026-06-01' && pt.d !== '2026-06-22') {
      assert.equal(pt.event, null, `${pt.d} 无事件必须是 null 而不是 undefined/空串`);
    }
  }
  /* 随访月 hCG：原文串照抄（'2.1' 不变成数字拼接），数值列存解析值；未填字段显式 NULL */
  const p2 = getProfile(db, 'lin');
  assert.deepEqual(p2.followup.months.map((m) => m.hcg), ['2.1', '0.6', '0.5'], 'hcg 原文串逐字还原');
  const pg = db.prepare('SELECT dnc_count, pathology_text FROM pregnancy_rows WHERE profile_key = ?').get('lin');
  assert.equal(pg.dnc_count, null, '清宫次数未记录就是 NULL，不落 0');
  assert.equal(pg.pathology_text, null, '妊娠档案的病理原文在 pathology_rows，此列 NULL');
  close(db);
});

test('⑦ 文件库：真实落盘 + 重开后资料仍在（播种只发生一次）', () => {
  mkdirSync(join(tmp, 'nested'), { recursive: true });
  const file = join(tmp, 'nested', 'xyb-gtn.sqlite');
  const db1 = openDatabase(file);
  migrate(db1);
  seedDemo(db1);
  close(db1);
  const db2 = openDatabase(file);
  migrate(db2);
  assert.equal(hasDemoData(db2), true, '重开后档案还在');
  assert.equal(seedDemo(db2).skipped, true, '重开后不应再播种一遍');
  close(db2);
});

test('⑧ 面板参数：0.65 与 AGENT_PANE.default 互补，assertPanelConfig 全绿', () => {
  assert.deepEqual(assertPanelConfig(PANEL, AGENT_PANE), [], '面板参数自检必须空');
  assert.equal(PANEL.businessWidth + AGENT_PANE.default, 1, 'businessWidth 与会话默认宽互补');
  /* 越界要被抓：businessWidth 上限 0.7 */
  const bad = assertPanelConfig({ ...PANEL, businessWidth: 0.72 }, AGENT_PANE);
  assert.ok(bad.length > 0, '0.72 越界必须报问题');
  const badSum = assertPanelConfig({ ...PANEL, businessWidth: 0.6 }, AGENT_PANE);
  assert.ok(badSum.some((x) => x.includes('互补')), '破坏互补关系必须报问题');
});

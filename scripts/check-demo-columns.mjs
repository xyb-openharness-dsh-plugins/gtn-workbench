#!/usr/bin/env node
/**
 * 列一致性校验（H6，GTN 版）。
 *
 * 为什么要有这个脚本：位置式 INSERT 列数不匹配只有跑到那一步才报错（胃癌那轮 6 连踩）。
 * 做法：把 schema/00*.sql **按编号全部执行**进一个 :memory: 库（0002/0003 是追加列，
 * 只跑 0001 会漏列），再把另一个 :memory: 库 migrate + seedDemo，逐表比对
 * PRAGMA table_info 的列名与顺序——比"盯着 SQL 数逗号"可靠。
 *
 * 额外检查：表集合双向相等；播种库除 schema_migrations 外每张表都有行（空表大概率是播种漏了）。
 *
 * 用法：node scripts/check-demo-columns.mjs
 * 退出码 0 = 通过；1 = 不一致（打印差异）。
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SCHEMA_DIR = join(ROOT, 'schema');

const problems = [];

const schemaDb = new DatabaseSync(':memory:');
for (const f of readdirSync(SCHEMA_DIR).filter((x) => x.endsWith('.sql')).sort()) {
  schemaDb.exec(readFileSync(join(SCHEMA_DIR, f), 'utf8'));
}

const { migrate } = await import('../dsh/store.js');
const { seedDemo } = await import('../dsh/demo.js');
const dataDb = new DatabaseSync(':memory:');
migrate(dataDb);
const seeded = seedDemo(dataDb);

const tablesOf = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all().map((r) => r.name);
const schemaTables = tablesOf(schemaDb);
const dataTables = tablesOf(dataDb).filter((t) => t !== 'schema_migrations');

for (const t of schemaTables) {
  if (!dataTables.includes(t)) problems.push(`schema 有表 ${t}，播种库里没有`);
}
for (const t of dataTables) {
  if (!schemaTables.includes(t)) problems.push(`播种库有表 ${t}，schema 里没有`);
}

const info = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => ({ name: c.name, type: (c.type || '').toUpperCase() }));
for (const t of schemaTables) {
  if (!dataTables.includes(t)) continue;
  const a = info(schemaDb, t), b = info(dataDb, t);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    problems.push(`表 ${t} 列不一致：\n    schema=${a.map((c) => c.name).join(',')}\n    播种库=${b.map((c) => c.name).join(',')}`);
  }
}

/* 空表白名单：section_titles（GTN 原型分节标题是页面常量，无档案级分节数据可播）
   与 viewpoints（demo 的情绪/等报告日/家庭记录按 0003 专用表存放，形状与 viewpoints 不同）。 */
const EMPTY_OK = new Set(['section_titles', 'viewpoints']);
for (const t of dataTables) {
  const n = dataDb.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  if (n === 0 && !EMPTY_OK.has(t)) problems.push(`表 ${t} 播种后仍是空表（大概率播种漏了）`);
}

if (problems.length) {
  console.error(`✗ 列一致性校验失败（${problems.length} 处）：`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`✓ 列一致性校验通过：${dataTables.length} 张表列序一致且全部有数据（hCG 行 ${seeded.hcg} · 疗程行 ${seeded.cycles} · 随访月 ${seeded.followup}）`);

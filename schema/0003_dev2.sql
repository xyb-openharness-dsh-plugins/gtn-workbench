/* 妊娠滋养细胞肿瘤（GTN）工作台 · 0003_dev2 · M5 开发版（v0.2.0 原型 12 页）。
 *
 * 0001/0002 已冻结，本文件只**新增**（freeze-contract.md 已追加哈希）。
 *
 * 背景：原型 v0.2.0 新增四条功能线（营养支持 / 心理支持 / 临床研究 / 指标分类卡），
 * demo-data.js 相应扩了 nutrition / mind / trials / metricCats。读模型 parity
 * （行还原成 demo-data.js 同一形状）需要这些行有表可放。
 *
 * 口径（与 0001 一致）：
 * - 营养：叶酸只照医嘱原文记录（folate TEXT），不给建议；口腔溃疡影响按自述（ulcer/ulcer_note）。
 * - 心理：情绪三态是用户自选（state TEXT: ok/flat/down），不是判读；整页私密仅本机。
 * - 临床研究：登记摘录快照（登记 ≠ 有效 ≠ 可入组），status 原文照抄，未核实。
 * - 指标分类卡：归口与入口（latest/count 是展示文案），分类不进趋势图。
 * - 全部行式表带 in_use/revision_of（更正只新增版本）；无任何判读列。
 */

/* ---------- 营养支持 ---------- */

CREATE TABLE nutrition_rows (      -- 化疗期每餐记录（自述）
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  d           TEXT,                -- 日期
  meal        TEXT,                -- 餐次（早餐/午餐/晚餐/加餐）
  intake      TEXT,                -- 吃了什么（自述原文）
  ulcer       TEXT,                -- '有' | '无'（按自述记录影响，非判读）
  ulcer_note  TEXT,                -- 口腔情况自述原文
  folate      TEXT,                -- 叶酸：只照医嘱原文记录
  ord         INTEGER,
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER
);

CREATE TABLE weight_rows (         -- 体重序列（手工记录，kg）
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  d           TEXT,
  value       REAL,
  ord         INTEGER,
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER
);

/* ---------- 心理支持（私密仅本机） ---------- */

CREATE TABLE mood_rows (           -- 情绪日记（三态自选：ok/flat/down）
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  d           TEXT,
  state       TEXT,                -- 用户自选三态，不是工具判读
  text        TEXT,
  ord         INTEGER,
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER
);

CREATE TABLE wait_rows (           -- 等 hCG 报告日记录（GTN 特异场景）
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  d           TEXT,
  text        TEXT,
  cope        TEXT,                -- 当时怎么撑过去的（自述）
  ord         INTEGER,
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER
);

CREATE TABLE family_rows (         -- 家庭/伴侣沟通记录（只留本人一侧叙述）
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  d           TEXT,
  who         TEXT,
  text        TEXT,
  ord         INTEGER,
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER
);

/* ---------- 临床研究（登记摘录快照） ---------- */

CREATE TABLE trials (
  record_id   TEXT PRIMARY KEY,    -- 登记号（如 CTR20252681）
  title       TEXT,
  sponsor     TEXT,
  status      TEXT,                -- 原文照抄：'登记状态，未核实'
  source      TEXT,                -- 来源平台
  url         TEXT,
  ord         INTEGER
);

/* ---------- 指标分类卡（3D 翻转卡，归口与入口） ---------- */

CREATE TABLE metric_cats (
  key         TEXT PRIMARY KEY,    -- hcg / cbc / liver / imaging
  name        TEXT,
  latest      TEXT,                -- 正面"最近值"展示文案
  count       INTEGER,             -- 已记录次数
  note        TEXT,                -- 背面记录说明
  go          TEXT,                -- 跳转页 key
  go_label    TEXT,
  ord         INTEGER
);

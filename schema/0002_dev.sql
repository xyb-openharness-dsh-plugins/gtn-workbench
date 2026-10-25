/* 妊娠滋养细胞肿瘤（GTN）工作台 · 0002_dev · M5 开发版补充列与表。
 *
 * 0001 已冻结（freeze-contract.md），本文件只**新增**，不改不删 0001 的任何列。
 *
 * 背景：0001 是按"记录最小事实"设计的，原型（public/demo-data.js 林小葡旅程）里
 * 还有一批"演示形状"的字段没有列可放。为了满足读模型 parity（行还原成 demo-data.js
 * 同一形状是唯一验收标准），按家族口径新增 0002：
 *
 * 1. pathology_rows：病理/影像**原文摘录**新表（src 出处 + text 原文，口径 D：只摘录不判读）。
 * 2. hcg_rows 追加 ver_at / ver_src：更正链上的版本行要记"何时改 / 为什么改"，
 *    （value 本身、revision_of、in_use 0001 已有）。
 * 3. chemo_cycles 追加 fields_json / ver_field / ver_at / ver_src：疗程卡 ≤6 字段
 *    （给药方式 / 周期 / 疗程位置 / 完成情况 / 复查血象）是"键值对展示区"，
 *    不是独立事实列，存 JSON 原文；更正链同 hCG。
 * 4. pregnancy_rows 追加 lmp / hospital / gest_week / uterus_size / bleeding：
 *    末次妊娠档案的展示字段（自述原文照抄）。
 * 5. followup_rows 追加 hcg_text：随访月 hCG 在化验单上常是 "0.5" 这类原文，
 *    数值列 hcg_value 存解析值（或 NULL），原文列存照抄串——显式 NULL ≠ 0 的口径不变。
 * 6. candidates 追加 filename / fields_json：候选卡要显示"哪个文件、抽出了哪些字段"。
 *
 * 判读列禁令（0001 同款）继续生效：本文件没有也不许有任何诊断/分级/风险判定列。
 */

/* ---------- 病理与影像原文摘录（口径 D） ---------- */

CREATE TABLE pathology_rows (
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  src         TEXT,               -- 出处（如"宫腔刮出物病理 · 2026-03-13 · 市一医院"）
  text        TEXT,               -- 原文摘录（不改写、不判读）
  ord         INTEGER,
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER
);

/* ---------- 追加列 ---------- */

ALTER TABLE hcg_rows ADD COLUMN ver_at TEXT;
ALTER TABLE hcg_rows ADD COLUMN ver_src TEXT;

ALTER TABLE chemo_cycles ADD COLUMN fields_json TEXT;
ALTER TABLE chemo_cycles ADD COLUMN ver_field TEXT;
ALTER TABLE chemo_cycles ADD COLUMN ver_at TEXT;
ALTER TABLE chemo_cycles ADD COLUMN ver_src TEXT;

ALTER TABLE pregnancy_rows ADD COLUMN lmp TEXT;
ALTER TABLE pregnancy_rows ADD COLUMN hospital TEXT;
ALTER TABLE pregnancy_rows ADD COLUMN gest_week TEXT;
ALTER TABLE pregnancy_rows ADD COLUMN uterus_size TEXT;
ALTER TABLE pregnancy_rows ADD COLUMN bleeding TEXT;

ALTER TABLE followup_rows ADD COLUMN hcg_text TEXT;

ALTER TABLE candidates ADD COLUMN filename TEXT;
ALTER TABLE candidates ADD COLUMN fields_json TEXT;

/* 妊娠滋养细胞肿瘤（GTN）工作台 · 0005_metrics · 多系列指标趋势与指标管理。
 *
 * 0001–0004 已冻结，本文件只**新增**（freeze-contract.md 追加哈希）。
 *
 * 背景：检查与指标页扩二级页签（血 hCG / 血常规 / 肝肾功能 / 体重 / 指标管理），
 * 血常规与肝肾功能序列各自成库，指标管理页做序列清单与显隐。
 *
 * 红线（本仓冻结口径）：
 * - **不设 ref_low / ref_high 判定列**：报告原文里的参考区间如需留底，进 note TEXT 原文照抄，
 *   读模型与页面不画带、不比对、不判读（check-prototype 断言）；
 * - value 存化验单数值（REAL），unit 文本照抄随行；in_use / revision_of 沿用更正链口径
 *   （更正=新增版本，旧值不丢，无裸删除）；
 * - 无 diagnosis / conclusion 类判读列（check-schema 判读列断言继续生效）；
 * - 体重序列仍在 weight_rows（0003），血 hCG 仍在 hcg_rows（0001），
 *   metric_* 只收血常规 / 肝肾功能这类化验序列，不搬家不复制。
 */

CREATE TABLE metric_series (         -- 指标序列定义（一个可比序列一行）
  id           INTEGER PRIMARY KEY,
  profile_key  TEXT,
  key          TEXT,                 -- 序列 key（wbc / neut / hgb / plt / alt / ast / cr …）
  name         TEXT,                 -- 序列名（含缩写，如「白细胞（WBC）」）
  unit         TEXT,                 -- 单位文本照抄（×10⁹/L、g/L、U/L、μmol/L）
  group_key    TEXT,                 -- 组别：cbc 血常规 / liver 肝肾功能（页面分节用）
  ord          INTEGER,              -- 组内展示顺序
  source       TEXT,                 -- 序列来源摘要（医院 / 化验单类型）
  in_use       INTEGER DEFAULT 1     -- 序列显隐（指标管理页可切换；隐藏不删数据）
);

CREATE TABLE metric_points (         -- 指标数据点（数值原文照抄）
  id           INTEGER PRIMARY KEY,
  profile_key  TEXT,
  series_key   TEXT,                 -- 对应 metric_series.key
  drawn_on     TEXT,                 -- 采样日期（真实日期入轴，未知不定位）
  value        REAL,                 -- 数值（照抄化验单；缺值不落 0）
  unit         TEXT,                 -- 单位文本随行照抄
  source       TEXT,                 -- 来源（医院 / 化验单摘要）
  note         TEXT,                 -- 原文备注（含参考区间等报告原文时**逐字照抄**，只作对照展示，不判读）
  in_use       INTEGER DEFAULT 1,
  revision_of  INTEGER               -- 更正链：指向被更正的点；旧值不丢
);

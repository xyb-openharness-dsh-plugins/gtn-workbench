/* 妊娠滋养细胞肿瘤（GTN）工作台 · 0004_match · 临床研究匹配（MATCHING-SPEC §4 三档算法）。
 *
 * 0001–0003 已冻结，本文件只**新增**（freeze-contract.md 已追加哈希）。
 *
 * 背景：trials 页按脚手架匹配模式重做——入组档案（全部来自既有病情数据，不重复录入）
 * + 检索双通道 + 三档匹配结果（已满足 / 可能冲突 / 无法判定 + 待确认规则单列）。
 *
 * 口径（MATCHING-SPEC §4）：
 * - 规则求值是确定性的：同样档案 revision + 同样规则集版本 = 同样结果，不调用模型判定；
 * - 三档枚举只用 satisfied / conflict / undetermined，JSON 键名固定为 tier；
 * - 缺失永远流向 undetermined，绝不流向 satisfied；
 * - 无任何 conclusion 类判读列（check-schema 判读列断言继续生效）；
 * - 待确认规则（pending=1）不进三档统计，读模型单列 pending 数组。
 */

CREATE TABLE match_rules (           -- 试验入排规则（结构化条件，绑定试验 record_id）
  id              INTEGER PRIMARY KEY,
  trial_record_id TEXT,              -- 对应 trials.record_id
  rule_text       TEXT,              -- 规则文本（登记原文的结构化改写，保留原意）
  field_key       TEXT,              -- 档案字段 key（age / pre_treatment_hcg / chemo_lines / liver_function / followup_capacity / pathology …）
  rule_type       TEXT,              -- age_range / disease_type / pathology_required / prior_therapy_count / organ_function / other …
  condition_json  TEXT,              -- 条件 JSON（如 {"op":"<","value":100000,"unit":"IU/L"}；other 类型存原文说明）
  pending         INTEGER DEFAULT 0, -- 1=待确认规则，不进三档统计
  ord             INTEGER
);

CREATE TABLE match_assessments (     -- 一次匹配分析的快照（可复现性：MATCHING-SPEC §4.5）
  id              INTEGER PRIMARY KEY,
  profile_key     TEXT,
  profile_revision TEXT,             -- 生成时的档案快照版本
  rule_set_version TEXT,             -- 生成时的规则集版本
  judgments_json  TEXT,              -- 逐条判定 JSON：{"<match_rules.id>":{"tier":"satisfied|conflict|undetermined","mine":"你的记录","src":"来源"}}
  generated_at    TEXT
);

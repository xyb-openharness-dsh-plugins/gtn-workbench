/* 妊娠滋养细胞肿瘤（GTN）工作台 · 初始数据模型（0001） · 小葡宝 GraPal（占位）
 *
 * 家族契约（与宫颈/乳腺等仓同源，改这里等于改契约）：
 *   1. 记录恒不为结论——本仓没有也不许有任何判读列（无 diagnosis / risk_level / 分级建议类列）；
 *      FIGO 评分八项只存"照抄原始分"，总分由读模型求和，表内不存"低危/高危"。
 *   2. 更正只新增版本不覆盖：各 *_rows 表带 revision_of + in_use，旧值永留；
 *   3. 事实四层不合并：文档 / 候选 / 记录 / 指标分表存放；
 *   4. 显式 NULL ≠ 0：未测/未填就是 NULL，不落 0；
 *   5. 读模型一律 ORDER BY rowid；分节标题进 section_titles 表（ cervical 0002 教训）。
 *
 * GTN 独有口径（写在冻结之前）：
 *   A. hCG 事件（平台期/反弹/达正常锚点）由用户依医嘱口径勾选（event_mark 列，TEXT 三值或 NULL），
 *      工具不做任何事件判定——没有 is_abnormal 列，永远不许加。
 *   B. 随访日历以 followup_anchor 记录（用户勾选的"hCG 达正常"日期）为锚推算月份，
 *      锚点本身是一条 hcg_rows 上的事件标记，不单设"治愈日期"权威列。
 *   C. 指南口径多源（NCCN 2.2026 / 中国 2021 / EOTTD）：followup_rows.source 记录本次节奏依据的
 *      出处（含"我的医嘱"），读模型渲染出处切换，不设唯一正确口径列。
 *   D. 病理/报告只存原文摘录（pathology_text），无阳 性/阴性枚举。
 *   E. 避孕与再生育记录（followup_rows.contraception / fertility_plan）为用户自述，无"安全"判定。
 */

/* ---------- 档案级 ---------- */

CREATE TABLE subjects (
  profile_key   TEXT PRIMARY KEY,
  name          TEXT,
  age           INTEGER,
  meta          TEXT,            -- 侧栏第二行（年龄 · 诊断 · 第 N 疗）
  headline      TEXT,            -- 看板顶部一句摘要（自述）
  stage_text    TEXT,            -- 医生分期原文照抄（如"Ⅱ期"），工具不自算
  mindset       TEXT,
  dash_keys     TEXT,            -- JSON 数组：看板卡顺序
  path          TEXT             -- JSON 数组：路径条
);

CREATE TABLE section_titles (
  profile_key TEXT,
  key         TEXT,
  title       TEXT,
  ord         INTEGER,
  PRIMARY KEY (profile_key, key)
);

/* ---------- 事实四层 ---------- */

CREATE TABLE documents (          -- 第一层：导入的原始文档
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  kind        TEXT,               -- 化验单/病理/出院小结/影像报告
  filename    TEXT,
  imported_at TEXT,
  sha256      TEXT,
  status      TEXT                -- parsed/pending/failed
);

CREATE TABLE candidates (         -- 第二层：AI/MinerU 解析候选，未核对不入记录
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  doc_id      INTEGER,
  field_key   TEXT,               -- 如 hcg_rows.value
  value_text  TEXT,
  status      TEXT DEFAULT 'pending',  -- pending/accepted/rejected
  reviewed_at TEXT
);

/* ---------- GTN 专属记录 ---------- */

CREATE TABLE hcg_rows (           -- hCG 血清序列（核心事实）
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  drawn_on    TEXT,               -- 采血日期
  value       REAL,               -- 原始数值照抄
  unit        TEXT DEFAULT 'IU/L',
  hospital    TEXT,
  event_mark  TEXT,               -- NULL | 'plateau' | 'rise' | 'anchor'（用户勾选，口径 A）
  note        TEXT,
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER             -- 更正链：指向被更正行的 id（家族口径 2）
);

CREATE TABLE chemo_cycles (       -- 化疗疗程折叠卡
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  cycle_no    INTEGER,            -- 第几疗
  regimen     TEXT,               -- 方案名（原文，如医嘱所写）
  start_on    TEXT,
  end_on      TEXT,
  hcg_on_day  REAL,               -- 当日（或最近一次）hCG，照抄
  note        TEXT,               -- 感受/备注（自述）
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER
);

CREATE TABLE pregnancy_rows (     -- 末次妊娠档案（诊断线索，自述）
  id           INTEGER PRIMARY KEY,
  profile_key  TEXT,
  preg_type    TEXT,              -- 葡萄胎(完全/部分)/流产/足月/其他——原文照抄
  preg_end_on  TEXT,
  dnc_count    INTEGER,           -- 清宫次数
  pathology_text TEXT,            -- 病理结论原文摘录（口径 D）
  in_use       INTEGER DEFAULT 1,
  revision_of  INTEGER
);

CREATE TABLE figo_rows (          -- FIGO/WHO 2000 预后评分自录表：八项照抄，不存总分判定
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  s_age       INTEGER,            -- ①年龄（0/1/2/4）
  s_preg_type INTEGER,            -- ②前次妊娠类型
  s_interval  INTEGER,            -- ③距前次妊娠时间
  s_hcg       INTEGER,            -- ④治疗前血 hCG
  s_tumor     INTEGER,            -- ⑤最大肿瘤大小
  s_met_site  INTEGER,            -- ⑥转移部位
  s_met_count INTEGER,            -- ⑦转移数目
  s_prev_fail INTEGER,            -- ⑧前次失败化疗
  source_note TEXT,               -- 抄自哪份报告
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER
);

CREATE TABLE followup_rows (      -- 治愈后随访月记录
  id             INTEGER PRIMARY KEY,
  profile_key    TEXT,
  month_no       INTEGER,         -- 锚点后第几月（读模型按锚点推算校验）
  drawn_on       TEXT,
  hcg_value      REAL,
  contraception  TEXT,            -- 自述（口径 E）
  fertility_plan TEXT,            -- 再生育计划自述
  source         TEXT,            -- 节奏出处：NCCN 2.2026 / 中国 2021 / EOTTD / 我的医嘱（口径 C）
  note           TEXT,
  in_use         INTEGER DEFAULT 1,
  revision_of    INTEGER
);

/* ---------- 通用 ---------- */

CREATE TABLE viewpoints (         -- 患者自述看法，恒不为结论
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  topic       TEXT,
  text        TEXT,
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER
);

CREATE TABLE question_rows (      -- 复诊问题清单
  id          INTEGER PRIMARY KEY,
  profile_key TEXT,
  text        TEXT,
  asked       INTEGER DEFAULT 0,  -- 是否已在复诊时问过
  in_use      INTEGER DEFAULT 1,
  revision_of INTEGER
);

CREATE TABLE guideline_sources (  -- 出处切换注册表（口径 C）
  key      TEXT PRIMARY KEY,      -- nccn-2026 / cma-2021 / eottd / my-doctor
  label    TEXT,
  version  TEXT,
  url      TEXT,
  note     TEXT
);

CREATE TABLE demo_meta (
  key  TEXT PRIMARY KEY,
  text TEXT
);

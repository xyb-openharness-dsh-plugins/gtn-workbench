# 迁移冻结合同（小葡宝 GraPal · GTN）

`schema/` 下的迁移一旦对外发布就不许再改：改历史迁移 = 两台机器的库结构不一样 = 数据不可复现。
本文件记每个迁移文件的 sha256，由 `scripts/check-schema.mjs` 逐条比对（含判读列断言）。

要改结构：**新增** `NNNN_name.sql`，并把新文件与哈希追加到下表末尾。

| 文件 | sha256 |
| --- | --- |
| `0001_initial.sql` | e94dcd45f42bdee460f0851feff44ebe67312291dbb9678c96390884cfeed94e |

## 0001 内容边界（冻结前审）

10 张表：档案级 2（subjects / section_titles）＋事实四层前两层（documents / candidates）＋GTN 专属 5（hcg_rows / chemo_cycles / pregnancy_rows / figo_rows / followup_rows）＋通用 3（viewpoints / question_rows / guideline_sources）＋demo_meta。

**判读列断言（check-schema 强制）**：全库列名禁 diagnosis / risk_level / severity / grade_judgement / is_abnormal / is_normal / conclusion；figo_rows 不存总分列（读模型求和）；hcg_rows.event_mark 只存用户勾选值。

| `0002_dev.sql` | 4986bdc308880be9969bab273fd80f130f9c12fcc4bb5990715e1efb04da0411 |

## 0002 内容边界（M5 开发版，2026-10-25 追加）

新增 pathology_rows 表 + 8 张表追加列（hcg_rows/chemo_cycles 更正链元数据、pregnancy_rows 展示字段、followup_rows.hcg_text 原文、candidates 文件与字段 JSON）。无判读列；不改不删 0001 任何定义。

| `0003_dev2.sql` | 024a333ebdd243650be474517fa2af8c8b7769d785979389f6fa45f40eb67804 |

## 0003 内容边界（M5 开发版，v0.2.0 原型 12 页，2026-10-25 追加）

新增 7 张表：营养（nutrition_rows/weight_rows）、心理（mood_rows/wait_rows/family_rows，整页私密仅本机）、临床研究登记摘录（trials）、指标分类卡（metric_cats）。无判读列（mood_rows.state 是用户自选三态原文）；不改不删 0001/0002 任何定义。

| `0004_match.sql` | 2acbd437127915d1592a0c55ce1b200fcf19c2bc9c9985e17b0588161e3a9bc5 |

## 0004 内容边界（v0.4.0，2026-10-25 追加）

新增 2 张表：入排规则库（match_rules，条件存 JSON、pending 单列）与匹配评估快照（match_assessments，档案 revision + 规则集版本 + 逐条判定 JSON + 生成时间）。三档枚举只出现在 judgments_json 的 tier 键（satisfied/conflict/undetermined）；无 conclusion 类判读列（判读列断言继续生效）；不改不删 0001–0003 任何定义。

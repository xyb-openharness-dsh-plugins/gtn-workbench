# 更新日志

## v0.5.0（2026-10-25）

用户反馈（最高优先级）：缺多系列指标——「检查与指标」二级页签页（血 hCG / 血常规 / 肝肾功能 / 体重 / 指标管理，24 号规范页内 Tab 口径，不拆全局菜单）；多系列趋势图（WBC+NEUT、ALT+AST 同单位双线，HGB / PLT / Cr 各自成图禁双轴，每序列可显隐，疗程起止中性竖条=档案事实标注，无参考区间带无高低判定）；指标管理页序列清单（显隐 / AI 导入候选不代发 / 数字键盘手工补录 / 更正=版本链）；schema 0005_metrics（metric_series + metric_points，不设 ref 判定列，参考区间只进 note 原文照抄）；demo 播种 7 序列 63 点；parity 快照重冻结 prototypes/v0.5；check-prototype +6 断言（42 项）。

## v0.4.0（2026-10-25）

临床研究模块按 MATCHING-SPEC 模式重做（用户指令）：入组档案完整度（8/10，不重复录入）+ 检索双通道（自带 sqlite 6 条 + AI 协助起草不代发）+ 三档确定性规则求值（已满足 14 / 可能冲突 5 / 无法判定 6，缺失永远无法判定）；schema 0004_match（tier 枚举，无判读列）；parity 快照冻结 prototypes/v0.4。

## v0.3.0（2026-10-25）

M5 开发版：七步移植（dsh 四件/demo/readmodels/public 定点替换/scripts/宿主接线四要素）+ MinerU 六部件 + apiBase v0.1.3 契约（交界守卫 /(^|\/)api$/ + 双形态回归 + 禁裸 throw）+ 面板 §2.2（customFrame 0.65/0.35 互补、可拖、五态开关）+ test 五套 31 项。schema 0002/0003 追加冻结。

## v0.2.0（2026-10-25）

原型 12 一级页（+病情一图秀/营养支持/心理支持/临床研究）+ 3D 指标分类翻转卡 + 页面密度对齐乳腺癌基准（用户反馈）；README 10 张实渲截图。

## v0.1.1（2026-10-25）

files allowlist 补 public/schema（改包升版）；截图与 README 同步。

## v0.1.0（2026-10-25）

M0–M2：认领 issue #38、init、GTN 原创 9 文档、三路调研（NCCN GTN 2.2026 / FIGO 2000 / 中华 2021；0 访谈如实分层；一级重名率 42.9%）、8 页原型（对数轴 hCG 曲线 Fritsch–Carlson、32 号折叠卡、CRUD 双通道）、独立评审 P0=0、schema/0001 冻结 + 判读列断言、fetch-gtn-trials 四件套（6 条，终态如实）。

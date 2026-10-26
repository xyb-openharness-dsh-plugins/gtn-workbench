# 开发计划（DEV-PLAN）v0.1 骨架

状态：🔧 M0 骨架。里程碑口径见 prompts/FULL-CYCLE-KICKOFF.md（M0–M9 + G1/G2/G3/V1/V2/V3）。

| 里程碑 | 内容 | 状态 |
|---|---|---|
| M0 | 领取 #38 + init + 9 文档骨架 + 接线前置（cordis root）+ staticPass | ✅ |
| M1 | 三路调研（医学核数/用户研究/家族对比）→ DIFF-MATRIX 实测 + SPEC/USER-RESEARCH/INTERACTION-DESIGN 全量 | ✅ 2026-10-25（G1 闸口用户未应答，按可回退推荐项继续，**签认待补**） |
| M2 | HTML 原型（demo 唯一源、32 折叠卡、30 窄宽、HVT X1–X4、agent-draft、独立评审 P0=0、README 6 实渲截图含收/展态） | ✅ v0.1.1（独立评审 2026-10-25：P0=0、P1 已修、P2#1/3/4/7/8 已修，#5/#6 记入 0002 待办；G2 用户未应答按推荐项继续，签认待补） |
| M3 | schema/0001 + freeze-contract sha256 + 判读列断言 | ✅ 10 表冻结，断言 0 违规（G3 随原型签认） |
| M4 | fetch-gtn-trials 四件套 | ✅ 6 条，一致性 6=6=6 |
| M5 | 七步移植 + MinerU 六部件 + apiBase 定稿契约 + test 五套 + check 全绿 + HVT 一致性 | ✅ v0.3.0（32 测试全绿）；临床匹配按 MATCHING-SPEC 重做 v0.4.0（三档，无百分比） |
| M6 | 装机（四要素对照、corepack pnpm、真机走查、截图刷新） | 🔶 装机层 ✅（四要素/pnpm/bundles/重启）；界面加载待用户新建会话确认（如实） |
| M7 | tag + release + CHANGELOG | ✅ v0.4.0 tag+Release（附 tgz+sha256） |
| M8 | BACKLOG 回填（先 pull） | ✅ #57 状态列 🔵 v0.4.0 |
| M9 | 经验收敛回流 starter | ✅ LESSONS 6 条 + ZERO-TO-DEV 开工前置 + CHANGELOG（starter c0bcc5d）；检查器待实施 2 项挂账 |

闸口：G1（M1 后）、G2（M2 后）、G3（M3 后）、V1/V2/V3（M5/M6）需停下签认，不跳。

## 追加迭代（M9 后，用户逐条反馈驱动 · 2026-10-25）

| 版本 | 触发 | 内容 | 状态 |
|---|---|---|---|
| v0.5.0 | 用户：GTN 没有多系列指标吗 | 检查与指标二级页签（血 hCG/血常规/肝肾功能/体重/指标管理）+ 多序列趋势 + schema 0005 | ✅ 已发布 tag+Release |
| v0.6.0 | 用户：每仓加疾病概要 ？ | 看板 ？ 图标 + README 四要素；推广全家族 10 仓 + starter 模板 DISEASE-BRIEF | ✅ 已推送 |
| v0.7.0 | 用户：AI 对话按钮 + 每页和 AI 讨论 | discussFacts 携带本页关键信息拉起对话栏（不代发）；固化 starter 28 号 IP11 | ✅ 已推送 |
| v0.8.0 | 用户：界面风格对齐 breast + 临床研究参考 biliary | 一图秀 breast rail 化；临床研究 35 号分层 + 三子页；修复 trialFavs 运行时错误 | ✅ 已推送（待 pack/装机/tag） |

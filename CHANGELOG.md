# 变更记录

只增不删；每条写清"改了什么 + 为什么 + 用户可见结果"。版本号与 VERSION、package.json 三处必须一致。

## 0.3.0 — 2026-10-25（M5 开发版）

- 七步移植完成（ZERO-TO-DEV §2.1）：dsh/{store,server,routes,workbench,demo,readmodels,index,import,mineru,settings}.js + lib/{layout,version,zip,client}.js + src/client.js + scripts/{dev-server,build-version,build-client,check-syntax,check-wording,check-version,check-demo-columns}。数据从 `${API_BASE}/api/gtn/bootstrap` 来，拿不到回退演示数据并出横幅。
- schema 新增 0002_dev.sql（更正链元数据/妊娠展示列/病理摘录表/候选文件列）与 0003_dev2.sql（营养/心理/临床研究/指标分类卡 7 表），哈希已追加 freeze-contract.md；0001 未动，判读列断言 0 违规。
- readmodels parity：库里行还原成 public/demo-data.js（v0.2.0 十二页版）同一形状，test/store.test.mjs deepStrictEqual 全绿；FIGO 总分读取时求和不落库；随访锚点从 hCG 事件行推导。
- 前端与原型 v0.2.0 逐字符对齐（test/ui-parity 7 项）：style.css 冻结不动，外壳样式进 shell.css；index.html 法定新增 noindex / AI 五态按钮 / splitter / 会话 dock / 数据横幅；app.js 只换数据来源与启动异步化，视图函数一个不动。
- apiBase 定稿契约 v0.1.3：API_BASE=挂载前缀，双形态回归 + /(^|\/)api$/ 交界守卫 + 禁裸 throw（test/api-base 4 项）。
- 面板 §2.2 全量：businessSide=left · businessWidth=0.65 与 AGENT_PANE.default=0.35 互补（assertPanelConfig 钉住）；customFrame + 拖动四条 + 窄容器覆盖式抽屉 + 原生会话恒定挂载 + 首子元素 <header> 避让。
- MinerU 六部件：mineru.js/import.js/settings.js + 云解析逐文件授权 UI + 候选核对入档（拒收零副作用）+ 设置页解析模式与凭据状态（只显示来源与掩码，不收集真实密钥）。
- 宿主接线四要素齐：package.json dsh 块 + cordis.patch.yml config.root + src/client.js→build-client→lib/client.js（check 含 build:client --check）+ 版本簿记升 0.3.0。
- npm run check 全绿（31 项测试 / 27 项原型断言 / schema 冻结 3 迁移 / 判读列 0 违规）。

## 0.2.0 — 2026-10-25

- 原型 12 一级页（新增一图秀/营养支持/心理支持/临床研究）+ 3D 指标分类翻转卡 + trials 与 research jsonl 同步（check-prototype 27 项）。

## 0.1.0 — 2026-10-25

- 由社区脚手架 dsh-wb-cli@1.5.4 (1541b8a) 初始化，仅有注册骨架与健康接口，无业务功能。

'use strict';
/* 小葡宝 GraPal v0.1.0 — 演示数据（唯一数据源）。
   人物"林小葡"为虚构人名；全部数值 / 日期 / 医院名称均为编造，仅用于交互演示。
   旅程：葡萄胎清宫（2026-03-12）→ hCG 周序列（15 点，含一次平台期事件与最终锚点）
        → 3 个 MTX 单药疗程 → hCG 达正常锚点（2026-06-22，用户勾选）→ hCG 达正常锚点后按月随访 3 条。 */
window.DEMO_DATA = {
  meta: { version: '0.5.0', build: '2026-10-25', family: '小 X 宝家族' },
  patient: {
    name: '林小葡', age: 29,
    headline: '29 岁 · 葡萄胎清宫后化疗 3 疗 · hCG 达正常锚点（你勾选）后随访第 3 个月（人名虚构，数据全部模拟）'
  },
  /* 末次妊娠档案 */
  pregnancy: {
    type: '完全性葡萄胎', lmp: '2026-01-18', evacuationDate: '2026-03-12',
    hospital: '市一医院（演示虚构）', gestWeek: '约 8 周（B 超核对）',
    uterusSize: '子宫如孕 10 周', bleeding: '停经 6 周起间断少量阴道出血'
  },
  /* FIGO/WHO 2000 评分自录：8 项，每项 0/1/2/4，照抄原始分 */
  figo: [
    { k: '年龄', opts: { 0: '< 40 岁', 1: '≥ 40 岁' }, picked: 0 },
    { k: '前次妊娠类型', opts: { 0: '葡萄胎', 1: '流产', 2: '足月产' }, picked: 0 },
    { k: '距前次妊娠时间', opts: { 0: '< 4 个月', 1: '4–6 个月', 2: '7–12 个月', 4: '> 12 个月' }, picked: 0 },
    { k: '治疗前血 hCG（IU/L）', opts: { 0: '< 10³', 1: '10³–10⁴', 2: '10⁴–10⁵', 4: '> 10⁵' }, picked: 2 },
    { k: '最大肿瘤大小（含子宫）', opts: { 0: '< 3 cm', 1: '3–4 cm', 2: '5 cm', 4: '> 5 cm' }, picked: 1 },
    { k: '转移部位', opts: { 0: '肺', 1: '脾、肾', 2: '胃肠道', 4: '肝、脑' }, picked: 0 },
    { k: '转移数目', opts: { 0: '0 个', 1: '1–3 个', 2: '4–8 个', 4: '> 8 个' }, picked: 1 },
    { k: '前次失败化疗', opts: { 0: '无', 2: '单药', 4: '两药及以上' }, picked: 0 }
  ],
  figoNote: '原始分照抄自出院记录（2026-04-18，市一医院）；总分仅自动求和，不代表分级建议。',
  /* 病理与影像原文摘录（仅摘录，不改写、不判读） */
  pathology: [
    { src: '宫腔刮出物病理 · 2026-03-13 · 市一医院', text: '"绒毛弥漫水肿，滋养细胞轻至中度增生，未见肌层浸润证据。"（原文摘录）' },
    { src: '胸部 CT 平扫 · 2026-04-15 · 市一医院', text: '"右肺上叶见一枚结节影，直径约 0.8 cm，转移待排，建议结合血 hCG 变化随诊。"（原文摘录）' }
  ],
  /* hCG 周序列：event 三态由用户勾选（plateau 平台期 / rise 反弹 / anchor 达正常锚点，与 schema/0001 hcg_rows.event_mark 同口径） */
  hcg: {
    unit: 'IU/L',
    points: [
      { d: '2026-03-16', v: 98700, src: '市一医院', event: null },
      { d: '2026-03-23', v: 56200, src: '市一医院', event: null },
      { d: '2026-03-30', v: 30400, src: '市一医院', event: null },
      { d: '2026-04-06', v: 15800, src: '市一医院', event: null },
      { d: '2026-04-13', v: 9600, src: '市一医院', event: null },
      { d: '2026-04-20', v: 8800, src: '市一医院', event: 'plateau' },
      { d: '2026-04-27', v: 4260, src: '市一医院', event: null,
        versions: [ /* 版本链示例：更正=新增版本，旧值不丢 */
          { v: '4200', at: '2026-04-27', src: 'AI 解析候选 → 逐项核对后录入' },
          { v: '4260', at: '2026-05-02', src: '对照化验单原件更正（改这一条）' }
        ] },
      { d: '2026-05-04', v: 2050, src: '市一医院', event: null },
      { d: '2026-05-11', v: 1180, src: '市一医院', event: null },
      { d: '2026-05-18', v: 610, src: '市一医院', event: null },
      { d: '2026-05-25', v: 348, src: '市一医院', event: null },
      { d: '2026-06-01', v: 512, src: '市一医院', event: 'rise' },
      { d: '2026-06-08', v: 87, src: '市一医院', event: null },
      { d: '2026-06-15', v: 23, src: '市一医院', event: null },
      { d: '2026-06-22', v: 6, src: '市一医院', event: 'anchor' }
    ]
  },
  /* 化疗疗程：3 疗，每疗 ≤6 字段 + 感受备注 */
  cycles: [
    { n: 1, regimen: '甲氨蝶呤（MTX）单药', start: '2026-04-20', end: '2026-05-08', hcgOnDay: 8800,
      fields: { '给药方式': '静脉滴注 d1–d5', '周期': '21 天', '疗程位置': '第 1 疗 / 共 3 疗', '完成情况': '按计划完成', '复查血象': '白细胞 3.2×10⁹/L（第 14 天）' },
      note: '第一疗那周胃口差，口腔溃疡疼了两天，含漱口水扛过去了。',
      versions: null },
    { n: 2, regimen: '甲氨蝶呤（MTX）单药', start: '2026-05-11', end: '2026-05-29', hcgOnDay: 1180,
      fields: { '给药方式': '静脉滴注 d1–d5', '周期': '21 天', '疗程位置': '第 2 疗 / 共 3 疗', '完成情况': '按计划完成', '复查血象': '白细胞 2.9×10⁹/L（第 10 天）' },
      note: '这次没有溃疡，就是容易累，睡得比平时多。',
      versions: [ /* 疗程更正示例：旧值进版本链 */
        { field: '结束日期', v: '2026-05-30', at: '2026-05-30', src: '初次录入（记错一天）' },
        { field: '结束日期', v: '2026-05-29', at: '2026-06-02', src: '对照出院小结更正（改这一条）' }
      ] },
    { n: 3, regimen: '甲氨蝶呤（MTX）单药', start: '2026-06-01', end: '2026-06-19', hcgOnDay: 512,
      fields: { '给药方式': '静脉滴注 d1–d5', '周期': '21 天', '疗程位置': '第 3 疗 / 共 3 疗', '完成情况': '按计划完成', '复查血象': '白细胞 3.5×10⁹/L（第 14 天）' },
      note: '最后一疗心态轻松些了，数值也在往下走。',
      versions: null }
  ],
  /* 锚点后随访：日期由用户在 hCG 记录上勾选生成（评审 P1 措辞修正：结论词不进工具文案） */
  followup: {
    anchor: '2026-06-22', anchorLabel: 'hCG 达正常锚点（用户勾选）',
    planMonths: 12,
    months: [
      { n: 1, due: '2026-07-22', hcg: '2.1', contra: '避孕套', fertility: '暂不考虑，先把随访走完' },
      { n: 2, due: '2026-08-22', hcg: '0.6', contra: '避孕套', fertility: '同上月' },
      { n: 3, due: '2026-09-22', hcg: '0.5', contra: '避孕套', fertility: '想问医生后续节奏' }
    ]
  },
  /* 随访相关文案的多出处切换（原文摘录，不预设唯一答案） */
  sources: {
    nccn: { label: 'NCCN GTN 2.2026', text: '"按医嘱规律监测血 hCG，随访问隔遵医嘱调整。"（中译示意·非逐字原文，以原文与你的医嘱为准——评审 P2#3）' },
    csm: { label: '中华医学会 2021 第四版', text: '"化疗后应严格避孕，随访时限遵医嘱执行。"（原文摘录，以你的医嘱为准）' },
    mine: { label: '我的医嘱', text: '我的医嘱：每月复查血 hCG，避孕方式与时长下次门诊逐条问清。' }
  },
  /* 复诊问题清单 */
  questions: [
    '第 4 个月查完 hCG 之后，后面的随访节奏要不要调整？',
    '口腔溃疡反复出现，有没有可以用的药？',
    '现在用避孕套避孕，需要换别的方式吗？',
    '一年随访结束后，再生育前要做哪些检查？'
  ],
  /* 资料导入：候选区（事实层之外的候选，未核对不入档） */
  imports: {
    docs: [
      { id: 'D1', name: '血hCG化验单_2026-09-22.jpg', date: '2026-09-22', type: '化验单', status: '已入档' },
      { id: 'D2', name: '出院小结_2026-06-19.pdf', date: '2026-06-19', type: '出院记录', status: '已入档' }
    ],
    candidates: [
      { id: 'C1', file: '血hCG化验单_2026-10-20.jpg', authorized: false, unverified: true, status: 'pending',
        fields: { '日期': '2026-10-20', '数值': '0.5', '单位': 'IU/L', '医院': '市一医院' } }
    ]
  },
  /* 营养支持：化疗期饮食记录（口腔溃疡影响按用户自述记录；叶酸补充只按医嘱记录，不写建议） */
  nutrition: {
    note: 'MTX（甲氨蝶呤）为叶酸拮抗类化疗药；叶酸 / 亚叶酸补充与否、剂量与时机，只照医嘱原文记录，本工具不生成任何补充建议。',
    meals: [
      { d: '2026-04-20', meal: '早餐', intake: '白粥半碗', ulcer: '有', ulcerNote: '溃疡第二天，咸的辣的都不敢碰，温凉的最能咽', folate: '按医嘱未服（化疗日）' },
      { d: '2026-04-20', meal: '午餐', intake: '蒸蛋 1 份 + 米汤', ulcer: '有', ulcerNote: '吸管喝的汤，固体只吃了几口', folate: '按医嘱未服（化疗日）' },
      { d: '2026-04-22', meal: '早餐', intake: '牛奶泡软面包', ulcer: '有', ulcerNote: '比昨天好一点', folate: '按医嘱服用（剂量照出院指导）' },
      { d: '2026-04-25', meal: '午餐', intake: '软面条 1 碗 + 鱼汤', ulcer: '无', ulcerNote: '', folate: '按医嘱服用' },
      { d: '2026-05-12', meal: '早餐', intake: '粥 + 鸡蛋 1 个', ulcer: '无', ulcerNote: '第二疗开始日，胃口一般', folate: '按医嘱未服（化疗日）' },
      { d: '2026-05-16', meal: '晚餐', intake: '排骨汤面 + 香蕉 1 根', ulcer: '无', ulcerNote: '', folate: '按医嘱服用' },
      { d: '2026-06-02', meal: '午餐', intake: '米饭半碗 + 清蒸鱼 + 青菜', ulcer: '无', ulcerNote: '第三疗期间，吃得比前两疗多', folate: '按医嘱未服（化疗日）' }
    ],
    weight: [
      { d: '2026-04-18', v: 54.2 }, { d: '2026-04-30', v: 52.8 },
      { d: '2026-05-15', v: 53.1 }, { d: '2026-06-01', v: 53.6 }, { d: '2026-10-20', v: 55.0 }
    ],
    quote: '「化疗那周嘴里破了，吃什么我得记下来问医生。」（改写句 · 0 访谈）'
  },
  /* 心理支持：情绪日记（三态）、等 hCG 报告日焦虑（GTN 特异）、家庭沟通；默认私密（仅本机） */
  mind: {
    moods: [
      { d: '2026-03-13', state: 'down', text: '清宫手术后第一天，看到病理单上的词，一个人在走廊坐了很久。' },
      { d: '2026-04-20', state: 'flat', text: '第一疗开始，反而踏实一点，总觉得在往前走。' },
      { d: '2026-06-25', state: 'ok', text: '数值走到很低了，医生说按计划随访，回家路上买了杯奶茶。' },
      { d: '2026-09-22', state: 'flat', text: '随访第 3 个月，抽血已经成习惯了。' },
      { d: '2026-10-24', state: 'ok', text: '把病历整理进这个工作台，感觉一年的事终于理顺了。' }
    ],
    waitDays: [
      { d: '2026-06-23', text: '昨天抽的血，今天下午出报告。从早上就反复看手机，饭也没心思做。', cope: '把手机放客厅，去阳台浇了花' },
      { d: '2026-09-22', text: '随访抽血日。等结果的两个小时里在门诊楼下走了四圈。', cope: '提前约了妈妈陪我来，出报告前她一直拉着我的手' }
    ],
    family: [
      { d: '2026-03-20', who: '丈夫', text: '跟他讲清楚了"葡萄胎不是我想留住就能留住的孩子"，他沉默了一会儿，说先把我照顾好。' },
      { d: '2026-05-02', who: '妈妈', text: '妈妈总问"什么时候能再要孩子"，我说要按随访节奏来，让她别催；她答应了但还是会念。' },
      { d: '2026-06-28', who: '丈夫', text: '一起看那条往下走的线，他说"你看，你在变好"。这句话我记下来。' }
    ],
    resources: [],
    quote: '「等结果那两天比化疗还难熬。」（改写句 · 0 访谈）'
  },
  /* 临床研究：research/gestational-trophoblastic/trials-2026.jsonl 真实登记摘录快照（6 条，2026-10-25 抓取） */
  trials: {
    sourceLabel: '中国药物临床试验登记平台（chinadrugtrials）',
    disclaimer: '登记 ≠ 有效 ≠ 可入组：此处仅摘录公开登记字段，状态均为「登记状态，未核实」，是否适合参与请与你的主诊医生和研究方核实。',
    items: [
      { recordId: 'CTR20192427', title: '甲氨蝶呤片人体生物等效性试验', sponsor: '未在摘录字段中公开', status: '登记状态，未核实', source: '中国药物临床试验登记平台', url: 'https://www.chinadrugtrials.org.cn/clinicaltrials.searchlistdetail.dhtml' },
      { recordId: 'CTR20220792', title: '甲氨蝶呤片在中国健康受试者中进行的人体生物等效性试验', sponsor: '未在摘录字段中公开', status: '登记状态，未核实', source: '中国药物临床试验登记平台', url: 'https://www.chinadrugtrials.org.cn/clinicaltrials.searchlistdetail.dhtml' },
      { recordId: 'CTR20222562', title: '甲氨蝶呤片人体生物等效性试验', sponsor: '未在摘录字段中公开', status: '登记状态，未核实', source: '中国药物临床试验登记平台', url: 'https://www.chinadrugtrials.org.cn/clinicaltrials.searchlistdetail.dhtml' },
      { recordId: 'CTR20222621', title: '甲氨蝶呤片在中国健康受试者中进行的人体生物等效性试验', sponsor: '未在摘录字段中公开', status: '登记状态，未核实', source: '中国药物临床试验登记平台', url: 'https://www.chinadrugtrials.org.cn/clinicaltrials.searchlistdetail.dhtml' },
      { recordId: 'CTR20252681', title: '评价注射用莱古比星联合用药在晚期卵巢癌和单药在晚期复发性/难治性绒毛膜癌受试者中的安全性、耐受性、药代动力学特征及初步有效性的多中心、开放的Ib/IIa期临床研究', sponsor: '未在摘录字段中公开', status: '登记状态，未核实', source: '中国药物临床试验登记平台', url: 'https://www.chinadrugtrials.org.cn/clinicaltrials.searchlistdetail.dhtml' },
      { recordId: 'CTR20263587', title: '甲氨蝶呤片空腹及餐后人体生物等效性研究', sponsor: '未在摘录字段中公开', status: '登记状态，未核实', source: '中国药物临床试验登记平台', url: 'https://www.chinadrugtrials.org.cn/clinicaltrials.searchlistdetail.dhtml' }
    ]
  },
  /* 临床研究匹配（MATCHING-SPEC §4 三档算法，GTN 语境化演示）：
     规则求值是确定性规则求值（同样档案 + 同样规则版本 = 同样结果），不调用模型判定；
     三档枚举 tier: satisfied 已满足 / conflict 可能冲突 / undetermined 无法判定；
     缺失永远流向无法判定；排序按数据来源顺序（trials ord），不按匹配度；
     待确认规则（pending）不进三档统计，单列一档。禁用百分比数字与一切倾向性排序/择优措辞。 */
  match: {
    profileRevision: 'rev-20261025-1',
    ruleSetVersion: 'gtn-match-rules-20261025',
    generatedAt: '2026-10-25T10:00:00+08:00',
    footerNote: '三档只说明记录与登记条件的比对结果，入组判断属于医生与研究中心。',
    channelsNote: '检索双通道：①自带库（登记摘录 6 条，快照 2026-10-25）；②AI 协助匹配（只起草提示词，不自动发送）。外部检索通道：脚本 fetch-gtn-trials-2026（终端态如实：需在终端手动运行，本页不代跑）。',
    entries: [
      { recordId: 'CTR20192427', pending: ['试验期间需采取避孕措施（登记原文未结构化，待确认）'],
        rules: [
          { text: '年龄 ≥18 岁', tier: 'satisfied', mine: '29 岁', src: '患者档案' },
          { text: '健康受试者（无活动性疾病）', tier: 'conflict', mine: '病理记录：完全性葡萄胎（GTN），已行 MTX 化疗 3 疗', src: '病理摘录 · 治疗记录' },
          { text: '治疗前血 hCG < 100000 IU/L', tier: 'satisfied', mine: '98700 IU/L（2026-03-16，序列首点）', src: 'hCG 时间线' },
          { text: '肝功能指标在参考范围内', tier: 'undetermined', mine: '出院小结有肝肾功能报告（2026-06-10），逐项数值未入档', src: '资料档案' }
        ] },
      { recordId: 'CTR20220792', pending: [],
        rules: [
          { text: '年龄 ≥18 岁', tier: 'satisfied', mine: '29 岁', src: '患者档案' },
          { text: '排除妊娠期或滋养细胞疾病患者（登记原文）', tier: 'conflict', mine: '末次妊娠为完全性葡萄胎（GTN），2026-03-12 清宫', src: '末次妊娠档案' },
          { text: '既往化疗线数 ≤1', tier: 'satisfied', mine: '1 线（MTX 单药 × 3 疗，2026-04-20 → 06-19）', src: '治疗记录' },
          { text: '肝功能指标在参考范围内', tier: 'undetermined', mine: '逐项数值未入档，无法比对', src: '资料档案' }
        ] },
      { recordId: 'CTR20222562', pending: [],
        rules: [
          { text: '年龄 ≥18 岁', tier: 'satisfied', mine: '29 岁', src: '患者档案' },
          { text: '健康受试者（无活动性疾病）', tier: 'conflict', mine: '病理记录：完全性葡萄胎（GTN）', src: '病理摘录' },
          { text: '能规律随访（试验要求按时访视）', tier: 'undetermined', mine: '未记录能否按试验节奏规律随访（other 类型规则，保留原文）', src: '（无对应记录）' }
        ] },
      { recordId: 'CTR20222621', pending: [],
        rules: [
          { text: '年龄 ≥18 岁', tier: 'satisfied', mine: '29 岁', src: '患者档案' },
          { text: '治疗前血 hCG < 100000 IU/L', tier: 'satisfied', mine: '98700 IU/L（2026-03-16）', src: 'hCG 时间线' },
          { text: '既往化疗线数 ≤2', tier: 'satisfied', mine: '1 线（MTX 单药 × 3 疗）', src: '治疗记录' },
          { text: '健康受试者（无活动性疾病）', tier: 'conflict', mine: '病理记录：完全性葡萄胎（GTN），已行化疗', src: '病理摘录 · 治疗记录' }
        ] },
      { recordId: 'CTR20252681', pending: [],
        rules: [
          { text: '年龄 ≥18 岁', tier: 'satisfied', mine: '29 岁', src: '患者档案' },
          { text: '经病理确诊的滋养细胞肿瘤', tier: 'satisfied', mine: '宫腔刮出物病理（2026-03-13）：「绒毛弥漫水肿，滋养细胞轻至中度增生」（原文摘录）', src: '病理摘录' },
          { text: '复发性/难治性绒毛膜癌受试者（登记原文，未能结构化）', tier: 'undetermined', mine: '档案记录为完全性葡萄胎化疗后随访中；是否属本试验目标人群，现有记录不足以判断', src: '（other 类型规则，需研究中心核实）' },
          { text: '治疗前血 hCG < 100000 IU/L', tier: 'satisfied', mine: '98700 IU/L（2026-03-16）', src: 'hCG 时间线' },
          { text: '既往化疗线数 ≤2', tier: 'satisfied', mine: '1 线（MTX 单药 × 3 疗）', src: '治疗记录' },
          { text: '肝功能指标在参考范围内', tier: 'undetermined', mine: '逐项数值未入档，无法比对', src: '资料档案' }
        ] },
      { recordId: 'CTR20263587', pending: [],
        rules: [
          { text: '年龄 ≥18 岁', tier: 'satisfied', mine: '29 岁', src: '患者档案' },
          { text: '健康受试者（无活动性疾病）', tier: 'conflict', mine: '病理记录：完全性葡萄胎（GTN）', src: '病理摘录' },
          { text: '既往化疗线数 ≤1', tier: 'satisfied', mine: '1 线（MTX 单药 × 3 疗）', src: '治疗记录' },
          { text: '能规律随访（试验要求按时访视）', tier: 'undetermined', mine: '未记录随访安排（other 类型规则，保留原文）', src: '（无对应记录）' }
        ] }
    ]
  },
  /* 多系列指标（检查与指标二级页签）：血常规四序列 + 肝肾功能三序列。
     红线：数值全部照抄化验单原文；单位恒随行；不设参考上下限判定列（schema 0005 口径）；
     无参考区间带、无高低判定文案；化疗疗程起止竖条只是档案事实标注。
     体重序列复用 nutrition.weight（同一来源，不另抄一份）；血 hCG 序列复用 hcg.points。 */
  metrics: {
    note: '多系列指标趋势：数值照抄、单位恒随行；不画参考区间带、不做高低判定；图上的疗程起止竖条是档案事实标注（第几疗 · 起止日），不是判读。',
    series: [
      /* 血常规：9 点，跨 3 个 MTX 疗程（疗前基线 + 每疗给药日 / 第 8 天 / 第 14 天），只呈现记录到的曲线 */
      { key: 'wbc', name: '白细胞（WBC）', unit: '×10⁹/L', group: 'cbc', ord: 1, inUse: true, source: '市一医院 · 化疗期血常规', note: null, points: [
        { d: '2026-04-18', v: 6.8 }, { d: '2026-04-27', v: 3.2 }, { d: '2026-05-04', v: 4.6 },
        { d: '2026-05-11', v: 5.1 }, { d: '2026-05-19', v: 2.9 }, { d: '2026-05-25', v: 4.4 },
        { d: '2026-06-01', v: 4.9 }, { d: '2026-06-09', v: 3.5 }, { d: '2026-06-15', v: 4.7 } ] },
      { key: 'neut', name: '中性粒细胞绝对值（NEUT）', unit: '×10⁹/L', group: 'cbc', ord: 2, inUse: true, source: '市一医院 · 化疗期血常规', note: null, points: [
        { d: '2026-04-18', v: 4.1 }, { d: '2026-04-27', v: 1.8 }, { d: '2026-05-04', v: 2.7 },
        { d: '2026-05-11', v: 3.0 }, { d: '2026-05-19', v: 1.6 }, { d: '2026-05-25', v: 2.5 },
        { d: '2026-06-01', v: 2.9 }, { d: '2026-06-09', v: 1.9 }, { d: '2026-06-15', v: 2.8 } ] },
      { key: 'hgb', name: '血红蛋白（HGB）', unit: 'g/L', group: 'cbc', ord: 3, inUse: true, source: '市一医院 · 化疗期血常规', note: null, points: [
        { d: '2026-04-18', v: 118 }, { d: '2026-04-27', v: 109 }, { d: '2026-05-04', v: 112 },
        { d: '2026-05-11', v: 110 }, { d: '2026-05-19', v: 104 }, { d: '2026-05-25', v: 108 },
        { d: '2026-06-01', v: 107 }, { d: '2026-06-09', v: 103 }, { d: '2026-06-15', v: 106 } ] },
      { key: 'plt', name: '血小板（PLT）', unit: '×10⁹/L', group: 'cbc', ord: 4, inUse: true, source: '市一医院 · 化疗期血常规', note: null, points: [
        { d: '2026-04-18', v: 236 }, { d: '2026-04-27', v: 168 }, { d: '2026-05-04', v: 198 },
        { d: '2026-05-11', v: 210 }, { d: '2026-05-19', v: 152 }, { d: '2026-05-25', v: 190 },
        { d: '2026-06-01', v: 205 }, { d: '2026-06-09', v: 175 }, { d: '2026-06-15', v: 212 } ] },
      /* 肝肾功能：6 点（疗前 / 各疗后节点），ALT 与 AST 同单位（U/L）可同图双线，Cr 另图 */
      { key: 'alt', name: '谷丙转氨酶（ALT）', unit: 'U/L', group: 'liver', ord: 1, inUse: true, source: '市一医院 · 化疗期肝肾功能', note: null, points: [
        { d: '2026-04-18', v: 22 }, { d: '2026-05-04', v: 35 }, { d: '2026-05-11', v: 28 },
        { d: '2026-05-25', v: 31 }, { d: '2026-06-09', v: 26 }, { d: '2026-06-19', v: 24 } ] },
      { key: 'ast', name: '谷草转氨酶（AST）', unit: 'U/L', group: 'liver', ord: 2, inUse: true, source: '市一医院 · 化疗期肝肾功能', note: null, points: [
        { d: '2026-04-18', v: 20 }, { d: '2026-05-04', v: 30 }, { d: '2026-05-11', v: 24 },
        { d: '2026-05-25', v: 27 }, { d: '2026-06-09', v: 23 }, { d: '2026-06-19', v: 22 } ] },
      { key: 'cr', name: '肌酐（Cr）', unit: 'μmol/L', group: 'liver', ord: 3, inUse: true, source: '市一医院 · 化疗期肝肾功能', note: null, points: [
        { d: '2026-04-18', v: 58 }, { d: '2026-05-04', v: 55 }, { d: '2026-05-11', v: 57 },
        { d: '2026-05-25', v: 54 }, { d: '2026-06-09', v: 56 }, { d: '2026-06-19', v: 55 } ] }
    ]
  },
  /* 指标分类（3D 翻转卡正面：最近值 + 次数；背面：说明 + 去记录）。分类卡只做归口；数值曲线在各二级页签画线。 */
  metricCats: [
    { key: 'hcg', name: 'hCG 序列', latest: '2026-10-20 · 0.5 IU/L', count: 16, note: '血 hCG 逐次记录（日期 / 数值 / 单位 / 来源），对数轴曲线在「检查与指标 → 血 hCG」页签；事件标记由你勾选。', go: 'hcg', goLabel: '去检查与指标 · 血 hCG' },
    { key: 'cbc', name: '血常规', latest: '2026-06-15 · 白细胞 4.7×10⁹/L', count: 36, note: 'WBC / NEUT / HGB / PLT 四序列趋势在「检查与指标 → 血常规」页签，仅陈列数值，不判高低。', go: 'hcg', goLabel: '去检查与指标 · 血常规' },
    { key: 'liver', name: '肝肾功能', latest: '2026-06-19 · ALT 24 U/L', count: 18, note: 'ALT / AST / Cr 序列趋势在「检查与指标 → 肝肾功能」页签；数值原文不改写、不做分级对照。', go: 'hcg', goLabel: '去检查与指标 · 肝肾功能' },
    { key: 'imaging', name: '影像随访', latest: '2026-04-15 · 胸部 CT 平扫', count: 2, note: '超声 / CT 等影像报告只做原文摘录（报告日期 / 医院 / 结论原文），不改写、不判读。', go: 'diagnosis', goLabel: '去诊断档案看摘录' }
  ],
  /* 设置页初始值 */
  settings: {
    dir: '/Users/linxiaopu/Documents/葡萄胎资料（演示路径）',
    parseMode: 'cloud',   // 'cloud' 云端解析（逐文件授权） | 'local' 本机解析
    cred: { source: '系统钥匙串', status: '未配置（演示原型不收集真实密钥）' },
    packs: [
      { name: 'NCCN GTN', ver: '2.2026', status: '已加载' },
      { name: '中华医学会 GTN 指南', ver: '2021 第四版', status: '已加载' },
      { name: 'FIGO/WHO 评分标准', ver: '2000', status: '已加载' }
    ]
  }
};

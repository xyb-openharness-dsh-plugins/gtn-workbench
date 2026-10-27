/* 36 号 · 疾病概要数据（小葡宝 GraPal · 妊娠滋养细胞肿瘤 GTN）
 *
 * 内容来源：本仓 README「? 疾病概要」段与 docs/CLINICAL-DATA.md（获取日期 2026-10-25）。
 * 只做公开资料的事实整理：不写判定、不复制指南条文、不编 URL。
 * 链接：2026-10-27 逐条经 primer-backfill-2026-10-27/verify-links.mjs 真浏览器验活，仅收 OK；
 *       验不活的条目一律 nolink:true 并在 note 写清原因，不冒充已取得原件。
 */
window.DISEASE_PRIMER = {
  brand: '小葡宝 GraPal',
  name: '妊娠滋养细胞肿瘤',
  en: 'Gestational Trophoblastic Neoplasia（GTN）',
  updated: '2026-10-27',
  sections: [
    {
      id: 'definition',
      title: '定义',
      intro: '妊娠滋养细胞肿瘤（GTN）是一组源自妊娠滋养细胞的疾病，主要包括侵蚀性葡萄胎、绒毛膜癌与胎盘部位滋养细胞肿瘤等，多继发于葡萄胎妊娠，好发于育龄女性；血 hCG 是贯穿诊断、疗效与随访的核心监测指标。',
      points: [
        '主要亚型：侵蚀性葡萄胎、绒毛膜癌、胎盘部位滋养细胞肿瘤等（本仓 README 与临床口径文档列出的名称）。',
        '常见背景：多继发于葡萄胎妊娠；服务人群为育龄女性（本仓 README）。',
        '核心监测指标：血 hCG，贯穿诊断、疗效与随访三个环节（本仓 README）。',
        '分期与评分口径：FIGO 2000 解剖学分期（Ⅰ–Ⅳ 期）与改良 WHO 预后评分（8 项，每项 0/1/2/4 分）；本台只照抄原始分并自动求和，不输出分档判定（本仓 docs/CLINICAL-DATA.md）。'
      ],
      sources: [
        { org: 'NCCN', doc: 'NCCN Guidelines · Gestational Trophoblastic Neoplasia', version: '2.2026', entry: true, url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1489', note: '临床版全文需在 NCCN 官网注册后取得；本台未取得该版原件' },
        { org: 'FIGO', doc: 'FIGO 2000 解剖学分期与改良 WHO 预后评分', version: '2000', nolink: true, note: '仓内原引 PMC8913924 经核为 2022 年回顾性分析，非 FIGO 2000 原文；期刊全文需订阅，本台未取得可验证原件' }
      ]
    },
    {
      id: 'evidence',
      title: '医学资料规范和指南情况',
      intro: '下表是本台已登记的文件与官方入口。「原件」列说明是否取得原件、是否只能到官方入口；未取得原件的行不写「已取得」。',
      table: {
        head: ['机构', '文件', '版本 / 年份', '原件', '本台用途'],
        rows: [
          ['NCCN', 'NCCN Guidelines · Gestational Trophoblastic Neoplasia', '2.2026（3.2025 已被取代）',
            { text: '官方入口 · 需自行注册后取得', kind: 'hub', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1489', note: '临床版全文需在 NCCN 官网注册；本台未取得该版原件' },
            'GTN 诊治总纲的版本参照'],
          ['FIGO', 'FIGO 2000 解剖学分期与改良 WHO 预后评分', '2000',
            { text: '未取得原件', nolink: true, note: '仓内原引 PMC8913924 经核实为 2022 年回顾性分析，非 FIGO 2000 原文；期刊全文需订阅' },
            '分期与评分的版本参照'],
          ['中华医学会妇产科学分会', '《妊娠滋养细胞疾病诊断与治疗指南》', '2021 年版（第四版）',
            { text: '未取得原件', nolink: true, note: '转载 PDF 与正式卷期未能核对，本台未取得可验证原件' },
            '中文规范的版本参照'],
          ['EOTTD', 'EOTTD 指南栏目（随访与避孕口径）', '2021–2025',
            { text: '指南栏目入口', kind: 'hub', url: 'https://eottd.org/guidelines/', note: '栏目页为公开入口；具体文件需在站内按主题取得，本台未取得文件原件' },
            '随访节奏的多源对照'],
          ['Cochrane', 'First-line chemotherapy in low-risk gestational trophoblastic neoplasia（CD007102）', '2016（pub4）',
            { text: '未取得原件', nolink: true, note: 'Cochrane 全文页与 DOI 均被人机验证拦截，本台未取得可验证原件' },
            '化疗方案的文献出处层（不载剂量）'],
          ['行业标准', 'YY/T 1192-2011（hCG 检测溯源）', '2011',
            { text: '未取得原件', nolink: true, note: '标准文本需购买；仓内标注的「WS/T 679」未查到原文' },
            'hCG 单位与溯源'],
          ['NMPA', '药品查询入口', '持续更新',
            { text: '未取得原件', nolink: true, note: '官网检索页返回 412 风控，未能验活；具体品种逐条核对' },
            '药品信息查询入口']
        ]
      },
      sources: [
        { org: 'NCCN', doc: 'NCCN Guidelines · Gestational Trophoblastic Neoplasia', version: '2.2026', entry: true, url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1489', note: '临床版全文需在 NCCN 官网注册后取得；本台未取得该版原件' },
        { org: 'EOTTD', doc: 'EOTTD 指南栏目', version: '2021–2025', original: false, secondaryUrl: 'https://eottd.org/guidelines/', note: '栏目入口；本台未取得具体文件原件' }
      ]
    },
    {
      id: 'landscape',
      title: '目前治疗全景概要',
      intro: '以下按分期与评分、化疗、随访、支持线分组，只写指南与文献列举了什么、用在哪一阶段；不排序、不比优劣、不载剂量。',
      groups: [
        {
          label: '分期与评分（治疗分层依据）',
          points: [
            'FIGO 2000 解剖学分期：Ⅰ–Ⅳ 期（本仓 docs/CLINICAL-DATA.md）。',
            '改良 WHO 预后评分 8 项：年龄、前次妊娠类型、距前次妊娠时间、治疗前血 hCG、最大肿瘤大小、转移部位、转移数目、前次失败化疗；每项 0/1/2/4 分。本台只照抄原始分并自动求和。'
          ]
        },
        {
          label: '化疗（指南列举的方案类别）',
          points: [
            'NCCN、中华医学会 GTD 指南与 Cochrane CD007102 均把化疗列为 GTN 的治疗类别之一。',
            '单药（甲氨蝶呤 / 放线菌素 D）与联合方案（EMA-CO）作为文献列举的类别出现；本台不载剂量，也不比较方案。'
          ]
        },
        {
          label: '随访（hCG 达锚点后）',
          points: [
            'hCG 达正常锚点（由用户勾选口径）后进入按月随访期。随访频度在多份文件里并存：NCCN 2.2026 / 中国 2021 / EOTTD；工作台内做出处切换，不预设唯一口径。',
            '避孕与再生育时机同样按出处切换记录，并由用户自录「我的医嘱」。'
          ]
        },
        {
          label: '支持线（教育与生育相关）',
          points: [
            '仓内按教育级登记心理与生育患教资料（妇科恶性肿瘤生育力保护临床路径 2025、生育力保存相关专家共识等）。',
            '营养、情绪与复诊问题清单只做记录，供与医生沟通时使用。'
          ]
        }
      ],
      points: [
        '以上是文献与指南里列出的手段，按病期与线序排列，不代表任何一项适合你。选哪一个，这一句需要问你的医生。'
      ],
      sources: [
        { org: 'NCCN', doc: 'NCCN Guidelines · Gestational Trophoblastic Neoplasia', version: '2.2026', entry: true, url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1489', note: '临床版全文需在 NCCN 官网注册后取得；本台未取得该版原件' },
        { org: 'Cochrane', doc: 'First-line chemotherapy in low-risk gestational trophoblastic neoplasia（CD007102）', version: '2016（pub4）', nolink: true, note: '全文页与 DOI 均被人机验证拦截，本台未取得可验证原件' },
        { org: '中华医学会妇产科学分会', doc: '《妊娠滋养细胞疾病诊断与治疗指南》', version: '2021 年版（第四版）', nolink: true, note: '转载 PDF 与正式卷期未能核对，本台未取得可验证原件' },
        { org: 'EOTTD', doc: 'EOTTD 指南栏目', version: '2021–2025', original: false, secondaryUrl: 'https://eottd.org/guidelines/', note: '栏目入口；本台未取得具体文件原件' }
      ]
    },
    {
      id: 'trend',
      title: '发展趋势',
      intro: '只记录已经发生的事实与版本更替，带日期或版本号；不预测、不推荐、不评价。',
      points: [
        '指南版本更替：NCCN Gestational Trophoblastic Neoplasia 由 3.2025 更新至 2.2026；仓内记录 3.2025 为撒哈拉以南非洲改编版，已被 2.2026 取代。',
        '分期与评分口径：FIGO 2000 解剖学分期与改良 WHO 预后评分仍是仓内引用的版本（2000）。',
        '随访节奏：NCCN 2.2026、中国 2021、CSCO 2026、EOTTD 多源并存，仓内以出处切换展示，未合并为单一节奏。',
        '登记规模：截至 2026-10-25，仓内临床试验库实测 GTN 相关登记摘录 6 条；中国药物临床试验登记与信息公示平台通道返回成功，其他通道未启用或失败，按「未查过」如实入库。',
        '研究线索：免疫治疗等方向在仓内仅登记为研究文献线索，截至 2026-10-25 未核实；本台不载疗效信息。'
      ],
      sources: [
        { org: 'NCCN', doc: 'NCCN Guidelines · Gestational Trophoblastic Neoplasia', version: '2.2026', entry: true, url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1489', note: '临床版全文需在 NCCN 官网注册后取得；本台未取得该版原件' },
        { org: 'EOTTD', doc: 'EOTTD 指南栏目', version: '2021–2025', original: false, secondaryUrl: 'https://eottd.org/guidelines/', note: '栏目入口；本台未取得具体文件原件' },
        { org: 'ClinicalTrials.gov', doc: 'GTN 相关登记检索', version: '截至 2026-10-25', original: true, kind: 'registry', url: 'https://clinicaltrials.gov/search?cond=Gestational%20Trophoblastic%20Neoplasia' }
      ]
    }
  ]
}

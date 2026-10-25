/* 面板布局参数（GTN / 小葡宝 GraPal）。
 *
 * 这里是 DSH 分栏合同的**唯一入参来源**：客户端 register、构建注入（scripts/build-client.mjs）
 * 与包级检查（scripts/check-host-contract.mjs）都读它。别处不许再写一份 0.65
 * （也别写它的补数 0.35）。
 *
 * ## 形态：customFrame（家族统一，见 ZERO-TO-DEV §2.2）
 *
 * 标准分栏下宿主只把 businessWidth 写成注册时的静态 CSS 变量，服务里没有
 * setBusinessWidth / togglePane，DOM 里也没有 splitter 节点——"可拖 + 可收起 + 顶栏开关"
 * 在那条路上不存在。所以本项目走 customFrame=true：宿主把原生会话节点作为
 * conversation prop 交给我们排版，拖动四条（容器 rect 夹取 / role=separator /
 * 键盘同精度 / localStorage 过 clamp）在 src/client.js 实现。
 *
 * businessSide=left：业务区在左、原生会话在最右（用户明确要求过"原生会话面板在最右"）。
 * businessWidth=0.65 与 AGENT_PANE.default=0.35 互补，由 assertPanelConfig() 钉住。
 */

/** 宿主面板参数（写进客户端 register 时逐字使用）。宿主强校验：businessSide ∈ left/right，businessWidth ∈ 0.25–0.7。 */
export const PANEL = Object.freeze({
  businessSide: 'left',
  businessWidth: 0.65,
  customFrame: true,
});

/** 宿主允许的 businessWidth 区间（宿主 client.js 强校验，越界直接抛错）。 */
export const HOST_LIMITS = Object.freeze({ min: 0.25, max: 0.7 });

/**
 * AI 会话面板的宽度档位（客户端拖动/键盘/预设共用这一份，客户端不留第二份数字）。
 * 单位是「占工作区宽度的比例」，区间 25%–45%：更窄读不了消息，更宽会把业务区
 * 压到 55% 以下、卡片提前换行。
 */
export const AGENT_PANE = Object.freeze({
  def: 0.35,
  default: 0.35,                              // 与 def 同值；新代码统一读 default
  min: 0.25,
  max: 0.45,
  step: 24,                                   // 键盘 ←/→ 的像素档位说明
  ratioStep: 0.02,                            // 键盘/鼠标共用的比例步进
  narrowBelowPx: 760,                         // 容器窄于此改覆盖式抽屉（≤420px）
  drawerMaxPx: 420,
  presets: Object.freeze({ narrow: 0.25, std: 0.35, wide: 0.45 }),
});

/** 把比例夹到 AGENT_PANE 区间；非数字一律回默认值。 */
export function clampAgentRatio(ratio) {
  const r = Number(ratio);
  if (!Number.isFinite(r)) return AGENT_PANE.def;
  return Math.min(AGENT_PANE.max, Math.max(AGENT_PANE.min, r));
}

/** 业务区像素宽度：宿主给的比例 × 窗口宽度。1440 → 936，1280 → 832。 */
export function businessPanePx(windowWidth, width = PANEL.businessWidth) {
  if (!Number.isFinite(windowWidth) || windowWidth <= 0) throw new TypeError('windowWidth 必须是正数');
  const ratio = width === undefined ? PANEL.businessWidth : width;
  if (!Number.isFinite(ratio) || ratio <= 0) throw new TypeError('width 必须是正数');
  return Math.round(windowWidth * ratio);
}

/**
 * 自检：返回问题清单，空数组表示合法。参数可注入，便于单测覆盖越界情形。
 * 只查宿主真正会校验的那几项，外加 AGENT_PANE 自己的区间与互补关系。
 */
export function assertPanelConfig(config = PANEL, agent = AGENT_PANE) {
  const problems = [];
  if (!config || typeof config !== 'object') return ['面板配置必须是对象'];

  if (!['left', 'right'].includes(config.businessSide)) {
    problems.push(`businessSide 只能是 left/right，当前 ${config.businessSide}`);
  }
  if (typeof config.customFrame !== 'boolean') {
    problems.push(`customFrame 必须是布尔值，当前 ${config.customFrame}`);
  }

  const w = config.businessWidth;
  if (!(typeof w === 'number' && Number.isFinite(w) && w >= HOST_LIMITS.min && w <= HOST_LIMITS.max)) {
    problems.push(`businessWidth 必须在 ${HOST_LIMITS.min}–${HOST_LIMITS.max} 之间，当前 ${w}`);
  } else if (w === HOST_LIMITS.max) {
    problems.push('businessWidth 不得取上限 0.7：贴到上限会把会话区压到 0.3 以下，本项目不这么做');
  }

  if (agent && typeof agent === 'object') {
    const { def, min, max, ratioStep } = agent;
    for (const [name, value] of Object.entries({ def, min, max, ratioStep })) {
      if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)) {
        problems.push(`AGENT_PANE.${name} 必须是正数，当前 ${value}`);
      }
    }
    if (typeof min === 'number' && typeof max === 'number' && min >= max) {
      problems.push(`AGENT_PANE.min(${min}) 必须小于 max(${max})`);
    }
    if (typeof def === 'number' && typeof min === 'number' && typeof max === 'number' && (def < min || def > max)) {
      problems.push(`AGENT_PANE.def(${def}) 必须落在 ${min}–${max} 区间内`);
    }
    if (typeof max === 'number' && max > HOST_LIMITS.max) {
      problems.push(`AGENT_PANE.max(${max}) 不得大于宿主上限 ${HOST_LIMITS.max}`);
    }
    /* 互补关系：businessWidth + AGENT_PANE.default = 1（面板默认占满工作区，两边同源） */
    if (typeof w === 'number' && typeof def === 'number' && Math.abs(w + def - 1) > 1e-9) {
      problems.push(`businessWidth(${w}) 与 AGENT_PANE.default(${def}) 必须互补（和为 1）`);
    }
  }
  return problems;
}

// Single source of truth for the home-page selector option sets. Kept as
// `as const` so each list also yields a literal-union type: the play-start
// UI (app/page.tsx) renders from the arrays, and the analytics schema
// (lib/analytics.ts) types its payload fields from the unions. That shared
// origin is what keeps the "content-free" events honest — an event field can
// only ever be one of these fixed labels, never free-form player text.

export const GENDERS = ["男性向", "女性向"] as const;

export const ART_STYLES = [
  "自动",
  "自定义",
  "京阿尼细腻日常",
  "新海诚唯美光影",
  "Galgame CG",
  "3D 动漫电影",
  "赛博朋克",
  "蒸汽波",
  "吉卜力治愈手绘",
  "哥特庄园",
  "废土科幻",
  // 以下为小众/区域性画风，留作长尾选项
  "古典厚涂油画",
  "极简中国水墨",
  "浮世绘木刻",
  "莫高窟壁画",
  "波斯细密画",
] as const;

export const PLOT_STYLES = ["平铺直叙", "多线转折", "悬疑烧脑", "治愈日常"] as const;

export const PACINGS = ["慢热细腻", "紧凑爽快"] as const;

export type Gender = (typeof GENDERS)[number];
export type ArtStyle = (typeof ART_STYLES)[number];
export type PlotStyle = (typeof PLOT_STYLES)[number];
export type Pacing = (typeof PACINGS)[number];

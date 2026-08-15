/**
 * 设置与排除规则。
 * 设置保存在 chrome.storage.local 的 "settings" 键下，
 * 收藏栏（书签 id 列表）保存在 "favorites" 键下。
 */

/** 触发高度范围，按视口百分比（0-100）。 */
export interface TriggerRange {
  /** 上边界（百分比），默认 0。 */
  startPercent: number
  /** 下边界（百分比），默认 100。 */
  endPercent: number
}

export type ExclusionType = 'domain' | 'url' | 'match'

/** 一条排除规则。 */
export interface ExclusionRule {
  id: string
  /** domain: 域名(含子域名)；url: 网址前缀；match: 通配符规则。 */
  type: ExclusionType
  value: string
  enabled: boolean
  /** 创建时间，便于展示。 */
  createdAt: number
}

export interface Settings {
  /** 面板停靠方向，默认左侧。 */
  panelSide: 'left' | 'right'
  /** 面板宽度（px）。 */
  panelWidthPx: number
  /** 面板高度（视口百分比），默认 100。 */
  panelHeightPercent: number
  /** 鼠标触发面板的垂直高度范围（视口百分比）。 */
  triggerRange: TriggerRange
  /** 边缘触发区宽度（px）。 */
  triggerWidthPx: number
  /** 打开延迟（ms）。 */
  openDelayMs: number
  /** 收起延迟（ms）。 */
  closeDelayMs: number
  /** 页面排除规则。 */
  exclusions: ExclusionRule[]
}

export const DEFAULT_SETTINGS: Settings = {
  panelSide: 'left',
  panelWidthPx: 340,
  panelHeightPercent: 100,
  triggerRange: { startPercent: 0, endPercent: 100 },
  triggerWidthPx: 14,
  openDelayMs: 150,
  closeDelayMs: 300,
  exclusions: [],
}

export const PANEL_WIDTH_MIN = 260
export const PANEL_WIDTH_MAX = 640
export const PANEL_HEIGHT_MIN = 40
export const PANEL_HEIGHT_MAX = 100

export function clampPanelWidth(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.panelWidthPx
  return Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, Math.round(value)))
}

export function clampPanelHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.panelHeightPercent
  return Math.min(PANEL_HEIGHT_MAX, Math.max(PANEL_HEIGHT_MIN, Math.round(value)))
}

export const SETTINGS_KEY = 'settings'
export const FAVORITES_KEY = 'favorites'

/** 校验高度范围：上下边界必须在 0-100 且 start < end。 */
export function isTriggerRangeValid(range: TriggerRange): boolean {
  const s = range.startPercent
  const e = range.endPercent
  if (!Number.isFinite(s) || !Number.isFinite(e)) return false
  if (s < 0 || e > 100 || s >= e) return false
  return true
}

export function clampPercent(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)))
}

export function mergeSettings(base: Settings, patch: Partial<Settings>): Settings {
  return {
    ...base,
    ...patch,
    panelWidthPx: clampPanelWidth(patch.panelWidthPx ?? base.panelWidthPx),
    panelHeightPercent: clampPanelHeight(
      patch.panelHeightPercent ?? base.panelHeightPercent
    ),
    triggerRange: patch.triggerRange ?? base.triggerRange,
    exclusions: patch.exclusions ?? base.exclusions,
  }
}

let ruleSeq = 0
export function createExclusionRule(type: ExclusionType, value: string): ExclusionRule {
  ruleSeq += 1
  return {
    id: `rule-${Date.now().toString(36)}-${ruleSeq}`,
    type,
    value: value.trim(),
    enabled: true,
    createdAt: Date.now(),
  }
}

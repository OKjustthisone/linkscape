/** Linkscape 设置页。 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExclusionRule, ExclusionType, Settings } from '../shared/settings'
import {
  DEFAULT_SETTINGS,
  createExclusionRule,
  isTriggerRangeValid,
  PANEL_HEIGHT_MAX,
  PANEL_HEIGHT_MIN,
  PANEL_WIDTH_MAX,
  PANEL_WIDTH_MIN,
} from '../shared/settings'
import { sendMessageToBackground } from '../shared/messages'
import type { TabInfo } from '../shared/messages'
import { suggestDomainRule, suggestUrlRule } from '../shared/url-matcher'
import { LogoMark } from '../panel/components/Icons'

const RANGE_PRESETS: { label: string; range: { startPercent: number; endPercent: number } }[] = [
  { label: '全高度', range: { startPercent: 0, endPercent: 100 } },
  { label: '上半区', range: { startPercent: 0, endPercent: 50 } },
  { label: '下半区', range: { startPercent: 50, endPercent: 100 } },
]

const RULE_TYPE_LABELS: Record<ExclusionType, string> = {
  domain: '域名',
  url: '网址',
  match: '通配符',
}

export function OptionsPage(): JSX.Element {
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [loaded, setLoaded] = useState(false)
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(undefined)
  const [newRuleType, setNewRuleType] = useState<ExclusionType>('domain')
  const [newRuleValue, setNewRuleValue] = useState('')
  const [newRuleError, setNewRuleError] = useState('')
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const { settings: s } = await sendMessageToBackground<{ settings: Settings }>({
          type: 'GET_SETTINGS',
        })
        setSettings({ ...DEFAULT_SETTINGS, ...s })
        const info = await sendMessageToBackground<TabInfo>({ type: 'GET_TAB_INFO' })
        // 设置页本身也是一个标签页，因此使用 SW 记录的最近网页 URL
        setCurrentUrl(info.lastWebUrl ?? info.active.url)
      } finally {
        setLoaded(true)
      }
    })()
  }, [])

  /** 保存设置（防抖后写回 SW）。 */
  const persist = useCallback((next: Settings): void => {
    setSettings(next)
    setSaved(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void sendMessageToBackground({ type: 'UPDATE_SETTINGS', patch: next }).catch(() => undefined)
      setSaved(false)
    }, 300)
  }, [])

  const update = (patch: Partial<Settings>): void => {
    persist({ ...settings, ...patch })
  }

  const updateRange = (startPercent: number, endPercent: number): void => {
    update({ triggerRange: { startPercent, endPercent } })
  }

  const addRule = (): void => {
    const value = newRuleValue.trim()
    if (!value) {
      setNewRuleError('请输入规则内容')
      return
    }
    if (newRuleType === 'domain' && value.includes('/')) {
      setNewRuleError('域名规则不要包含路径，例如 example.com')
      return
    }
    const rule = createExclusionRule(newRuleType, value)
    update({ exclusions: [...settings.exclusions, rule] })
    setNewRuleValue('')
    setNewRuleError('')
  }

  const addCurrentSite = (type: 'domain' | 'url'): void => {
    if (!currentUrl) return
    const value = type === 'domain' ? suggestDomainRule(currentUrl) : suggestUrlRule(currentUrl)
    if (!value) return
    const rule = createExclusionRule(type, value)
    update({ exclusions: [...settings.exclusions, rule] })
  }

  const removeRule = (id: string): void => {
    update({ exclusions: settings.exclusions.filter((r) => r.id !== id) })
  }

  const toggleRule = (id: string): void => {
    update({
      exclusions: settings.exclusions.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      ),
    })
  }

  const rangeValid = isTriggerRangeValid(settings.triggerRange)

  return (
    <div className="opt-page">
      <div className="opt-hero">
        <LogoMark />
        <div>
          <h1>Linkscape 设置</h1>
          <p>面板停靠、触发范围与页面排除规则</p>
        </div>
      </div>

      {!loaded && <div className="ls-empty">加载中…</div>}

      {loaded && (
        <>
          {/* 面板位置 */}
          <section className="opt-section glass">
            <h2>面板停靠方向</h2>
            <p className="opt-desc">鼠标靠近页面边缘时，面板从哪一侧展开。</p>
            <div className="opt-side-options">
              <div
                className={`opt-side-card ${settings.panelSide === 'left' ? 'active' : ''}`}
                onClick={() => update({ panelSide: 'left' })}
                role="radio"
                aria-checked={settings.panelSide === 'left'}
              >
                <div className="opt-side-visual">
                  <div className="bar left" />
                </div>
                <strong>左侧（默认）</strong>
              </div>
              <div
                className={`opt-side-card ${settings.panelSide === 'right' ? 'active' : ''}`}
                onClick={() => update({ panelSide: 'right' })}
                role="radio"
                aria-checked={settings.panelSide === 'right'}
              >
                <div className="opt-side-visual">
                  <div className="bar right" />
                </div>
                <strong>右侧</strong>
              </div>
            </div>
          </section>

          {/* 面板尺寸 */}
          <section className="opt-section glass">
            <h2>面板尺寸</h2>
            <p className="opt-desc">调整悬浮面板的宽度和高度。高度按当前视口百分比计算。</p>
            <div className="opt-advanced">
              <div className="opt-field">
                <label>面板宽度（px）</label>
                <input
                  className="ls-input"
                  type="number"
                  min={PANEL_WIDTH_MIN}
                  max={PANEL_WIDTH_MAX}
                  step={10}
                  value={settings.panelWidthPx}
                  onChange={(e) => update({ panelWidthPx: Number(e.target.value) })}
                />
              </div>
              <div className="opt-field">
                <label>面板高度（%）</label>
                <input
                  className="ls-input"
                  type="number"
                  min={PANEL_HEIGHT_MIN}
                  max={PANEL_HEIGHT_MAX}
                  value={settings.panelHeightPercent}
                  onChange={(e) => update({ panelHeightPercent: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="opt-range-hint">
              默认：340px 宽、100% 高度；高度较小时面板会在视口中垂直居中。
            </div>
          </section>

          {/* 触发高度范围 */}
          <section className="opt-section glass">
            <h2>触发高度范围</h2>
            <p className="opt-desc">
              鼠标 <code>Y</code> 坐标落在该范围内才允许展开面板（按视口百分比）。
            </p>
            <div className="opt-range-presets">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  className="ls-btn sm"
                  onClick={() => updateRange(p.range.startPercent, p.range.endPercent)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="opt-range-inputs">
              <label>上边界</label>
              <input
                className="ls-input"
                type="number"
                min={0}
                max={100}
                value={settings.triggerRange.startPercent}
                onChange={(e) =>
                  updateRange(Number(e.target.value), settings.triggerRange.endPercent)
                }
              />
              <label>%</label>
              <label style={{ marginLeft: 8 }}>下边界</label>
              <input
                className="ls-input"
                type="number"
                min={0}
                max={100}
                value={settings.triggerRange.endPercent}
                onChange={(e) =>
                  updateRange(settings.triggerRange.startPercent, Number(e.target.value))
                }
              />
              <label>%</label>
            </div>
            <div className={`opt-range-hint ${rangeValid ? '' : 'bad'}`}>
              {rangeValid
                ? `生效范围：视口从上到下 ${settings.triggerRange.startPercent}% ～ ${settings.triggerRange.endPercent}%`
                : '⚠ 上边界必须小于下边界，且都在 0–100 之间'}
            </div>
          </section>

          {/* 高级 */}
          <section className="opt-section glass">
            <h2>高级</h2>
            <p className="opt-desc">触发灵敏度与动画延迟（毫秒）。</p>
            <div className="opt-advanced">
              <div className="opt-field">
                <label>边缘触发区宽度（px）</label>
                <input
                  className="ls-input"
                  type="number"
                  min={8}
                  max={24}
                  value={settings.triggerWidthPx}
                  onChange={(e) => update({ triggerWidthPx: Number(e.target.value) })}
                />
              </div>
              <div className="opt-field">
                <label>打开延迟（ms）</label>
                <input
                  className="ls-input"
                  type="number"
                  min={0}
                  max={2000}
                  value={settings.openDelayMs}
                  onChange={(e) => update({ openDelayMs: Number(e.target.value) })}
                />
              </div>
              <div className="opt-field">
                <label>收起延迟（ms）</label>
                <input
                  className="ls-input"
                  type="number"
                  min={0}
                  max={2000}
                  value={settings.closeDelayMs}
                  onChange={(e) => update({ closeDelayMs: Number(e.target.value) })}
                />
              </div>
            </div>
          </section>

          {/* 排除页面 */}
          <section className="opt-section glass">
            <h2>排除页面</h2>
            <p className="opt-desc">
              匹配规则后，页面不会创建触发区、也不加载面板 UI。规则即时生效。
            </p>

            {settings.exclusions.length === 0 ? (
              <div className="opt-empty-rules">还没有排除规则。</div>
            ) : (
              <div className="opt-rule-list">
                {settings.exclusions.map((rule: ExclusionRule) => (
                  <div key={rule.id} className={`opt-rule ${rule.enabled ? '' : 'disabled'}`}>
                    <span className="opt-rule-type">{RULE_TYPE_LABELS[rule.type]}</span>
                    <span className="opt-rule-value" title={rule.value}>
                      {rule.value}
                    </span>
                    <button
                      className={`opt-rule-toggle ${rule.enabled ? 'on' : ''}`}
                      title={rule.enabled ? '点击停用' : '点击启用'}
                      onClick={() => toggleRule(rule.id)}
                    />
                    <button className="ls-btn sm danger" onClick={() => removeRule(rule.id)}>
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="opt-rule-add">
              <select
                className="ls-select"
                value={newRuleType}
                onChange={(e) => setNewRuleType(e.target.value as ExclusionType)}
              >
                <option value="domain">域名</option>
                <option value="url">网址前缀</option>
                <option value="match">通配符</option>
              </select>
              <input
                className="ls-input"
                placeholder={
                  newRuleType === 'domain'
                    ? '例如 example.com（含子域名）'
                    : newRuleType === 'url'
                      ? '例如 https://example.com/docs'
                      : '例如 *://*.example.com/*'
                }
                value={newRuleValue}
                onChange={(e) => setNewRuleValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addRule()
                }}
              />
              <button className="ls-btn primary" onClick={addRule}>
                添加规则
              </button>
            </div>
            {newRuleError && <div className="opt-range-hint bad">{newRuleError}</div>}

            <div className="opt-current-site">
              <span className="hint">快速添加最近浏览的网页：</span>
              {currentUrl ? (
                <>
                  <button className="ls-btn sm" onClick={() => addCurrentSite('domain')}>
                    添加当前网站（域名）
                  </button>
                  <button className="ls-btn sm" onClick={() => addCurrentSite('url')}>
                    添加当前页面（网址）
                  </button>
                </>
              ) : (
                <span className="hint">尚未浏览过网页</span>
              )}
            </div>
          </section>

          {/* 说明 */}
          <section className="opt-section glass">
            <h2>说明</h2>
            <p className="opt-desc">
              <code>chrome://</code>、Chrome 应用商店、扩展管理页等受保护页面无法注入面板；
              在这些页面上点击扩展图标，可打开完整管理页继续使用书签功能。
              <br />
              快捷键：<code>Alt+Shift+L</code> 可在当前页面手动打开 / 收起面板；
              面板内 <code>Ctrl+F</code> 聚焦搜索，<code>Esc</code> 收起。
            </p>
          </section>
        </>
      )}

      <div className={`opt-save-state ${saved ? '' : 'hidden'}`}>✓ 已保存</div>
    </div>
  )
}

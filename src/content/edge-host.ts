/**
 * 边缘触发区 + 面板生命周期。
 *
 * - 根据设置创建左右边缘触发区（默认 14px，pointer-events: none，不遮挡网页）
 * - window mousemove 判断：是否在选定边缘 + clientY 是否落在触发高度范围内
 * - 打开延迟 / 收起延迟，鼠标进入面板保持展开
 * - Shadow DOM 隔离样式；排除页面不创建面板
 * - 监听 SW 的 PANEL_TOGGLE / PANEL_OPEN / PANEL_CLOSE / SETTINGS_CHANGED
 */

import type {
  ExtensionToContentMessage,
} from '../shared/messages'
import type { BackgroundRequest } from '../shared/messages'
import { sendMessageToBackground } from '../shared/messages'
import {
  clampPanelHeight,
  clampPanelWidth,
  DEFAULT_SETTINGS,
  isTriggerRangeValid,
  type Settings,
} from '../shared/settings'
import { isProtectedUrl, matchUrlAgainstRules } from '../shared/url-matcher'
import { mountPanel, type MountedPanel } from '../panel/panel-mount'
import panelCss from '../styles/panel.css?raw'

/** 边缘触发区的最小/最大宽度约束。 */
export const TRIGGER_WIDTH_MIN = 8
export const TRIGGER_WIDTH_MAX = 24

export interface EdgeHost {
  open(): void
  close(): void
  toggle(): void
  isOpen(): boolean
}

/** 结构兼容的消息（用于区分是否下发给内容脚本）。 */
type BackgroundRequestLike = BackgroundRequest

export function initEdgeHost(): EdgeHost | null {
  if (isProtectedUrl(location.href)) return null
  return new EdgeHostImpl()
}

class EdgeHostImpl implements EdgeHost {
  private hostEl: HTMLDivElement | null = null
  private rootEl: HTMLDivElement | null = null // 进入 shadow root 的根节点
  private settings: Settings = { ...DEFAULT_SETTINGS }
  private enabled = false // 页面是否被排除
  private panelOpen = false
  private openTimer: ReturnType<typeof setTimeout> | null = null
  private closeTimer: ReturnType<typeof setTimeout> | null = null
  private zoneHover = false
  private panelFocused = false
  private zoomFactor = 1
  private disposed = false
  private mountedPanel: MountedPanel | null = null

  constructor() {
    void this.init()
  }

  private async init(): Promise<void> {
    await Promise.all([this.loadSettings(), this.loadZoom()])
    this.installMouseListeners()
    this.installMessageListener()
    this.installUrlChangeListener()
    this.evaluateEnabled()
  }

  /* ---------------- DOM ---------------- */

  private createDom(): void {
    const hostEl = document.createElement('div')
    hostEl.id = 'linkscape-root'
    hostEl.style.cssText =
      'all:initial;position:fixed;inset:0;width:100vw;height:100vh;' +
      'z-index:2147483647;pointer-events:none;'
    const shadow = hostEl.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = panelCss

    const rootEl = document.createElement('div')
    rootEl.className = 'ls-root ls-side-left'
    rootEl.setAttribute('data-linkscape', 'panel')
    rootEl.appendChild(style)

    const zone = document.createElement('div')
    zone.className = 'ls-zone'
    rootEl.appendChild(zone)

    const panel = document.createElement('div')
    panel.className = 'ls-panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', 'Linkscape 书签面板')
    rootEl.appendChild(panel)

    shadow.appendChild(rootEl)
    document.documentElement.appendChild(hostEl)

    this.hostEl = hostEl
    this.rootEl = rootEl
    this.applyZoom()
    this.mountedPanel = mountPanel(panel, {
      open: () => this.open(),
      close: () => this.close(),
      onPanelEnter: () => this.onPanelEnter(),
      onPanelLeave: () => this.onPanelLeave(),
      getSettings: () => this.settings,
    })
    this.applySide()
  }

  private teardownHost(): void {
    this.cancelOpen()
    this.cancelClose()
    this.panelOpen = false
    this.hostEl?.remove()
    this.hostEl = null
    this.rootEl = null
    this.mountedPanel = null
  }

  private applySide(): void {
    if (!this.rootEl) return
    this.rootEl.classList.toggle('ls-side-left', this.settings.panelSide === 'left')
    this.rootEl.classList.toggle('ls-side-right', this.settings.panelSide === 'right')
    const zone = this.rootEl.querySelector('.ls-zone') as HTMLDivElement | null
    if (zone) {
      const w = this.getTriggerWidth()
      zone.style.width = `${w}px`
      this.rootEl.style.setProperty('--ls-zone-w', `${w}px`)
    }
    this.rootEl.style.setProperty('--ls-panel-w', `${clampPanelWidth(this.settings.panelWidthPx)}px`)
    this.rootEl.style.setProperty('--ls-panel-h', `${clampPanelHeight(this.settings.panelHeightPercent)}%`)
  }

  private getTriggerWidth(): number {
    const value = Number.isFinite(this.settings.triggerWidthPx)
      ? this.settings.triggerWidthPx
      : DEFAULT_SETTINGS.triggerWidthPx
    return Math.min(TRIGGER_WIDTH_MAX, Math.max(TRIGGER_WIDTH_MIN, value))
  }

  /** 抵消 Chrome 页面缩放，保持面板的物理尺寸不随网页缩放变化。 */
  private applyZoom(): void {
    if (!this.hostEl) return
    const factor = Number.isFinite(this.zoomFactor) && this.zoomFactor > 0
      ? this.zoomFactor
      : 1
    this.hostEl.style.transformOrigin = 'top left'
    this.hostEl.style.width = factor === 1 ? '100vw' : `calc(100vw * ${factor})`
    this.hostEl.style.height = factor === 1 ? '100vh' : `calc(100vh * ${factor})`
    this.hostEl.style.transform = factor === 1 ? 'none' : `scale(${1 / factor})`
  }

  /* ---------------- 设置 / 排除 ---------------- */

  private async loadSettings(): Promise<void> {
    try {
      const data = await sendMessageToBackground<{ settings: Settings }>({
        type: 'GET_SETTINGS',
      })
      this.settings = { ...DEFAULT_SETTINGS, ...data.settings }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS }
    }
    this.applySide()
  }

  private async loadZoom(): Promise<void> {
    try {
      const data = await sendMessageToBackground<{ zoomFactor: number }>({
        type: 'GET_TAB_ZOOM',
      })
      this.zoomFactor = data.zoomFactor
      this.applyZoom()
    } catch {
      this.zoomFactor = 1
    }
  }

  private isExcluded(): boolean {
    return matchUrlAgainstRules(location.href, this.settings.exclusions)
  }

  /** 依据当前 URL 与设置启用 / 停用面板（排除页不创建面板 UI）。 */
  private evaluateEnabled(): void {
    const wantEnabled = !this.isExcluded()
    if (wantEnabled === this.enabled) return
    this.enabled = wantEnabled
    if (wantEnabled) {
      this.createDom()
    } else {
      this.teardownHost()
    }
  }

  /* ---------------- 鼠标逻辑 ---------------- */

  private installMouseListeners(): void {
    window.addEventListener('mousemove', this.onMouseMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', this.onMouseLeave)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.enabled || !this.hostEl) return
    const side = this.settings.panelSide
    const width = this.getTriggerWidth()
    const atEdge =
      side === 'left'
        ? e.clientX <= width
        : e.clientX >= window.innerWidth - width

    const pct = (e.clientY / window.innerHeight) * 100
    const inRange =
      isTriggerRangeValid(this.settings.triggerRange) &&
      pct >= this.settings.triggerRange.startPercent &&
      pct <= this.settings.triggerRange.endPercent

    // 鼠标是否在展开的面板上（面板比触发区宽）
    const panelWidth = Math.min(clampPanelWidth(this.settings.panelWidthPx), window.innerWidth)
    const overPanel =
      this.panelOpen &&
      (side === 'left'
        ? e.clientX <= panelWidth
        : e.clientX >= window.innerWidth - panelWidth)

    this.setZoneHover(atEdge && inRange && !this.panelOpen)

    if (atEdge && inRange && !this.panelOpen) {
      this.cancelClose()
      if (!this.openTimer) {
        this.openTimer = setTimeout(
          () => this.open(),
          Math.max(0, this.settings.openDelayMs)
        )
      }
    } else if (this.panelOpen && !overPanel && !this.panelFocused) {
      this.cancelOpen()
      this.scheduleClose()
    } else {
      this.cancelOpen()
      if (this.panelOpen && (overPanel || this.panelFocused)) {
        this.cancelClose()
      }
    }
  }

  private onMouseLeave = (): void => {
    if (this.panelOpen) this.scheduleClose()
  }

  private onVisibilityChange = (): void => {
    if (document.hidden) {
      this.cancelOpen()
      this.close()
    }
  }

  private onPanelEnter = (): void => {
    this.panelFocused = true
    this.cancelClose()
  }

  private onPanelLeave = (): void => {
    this.panelFocused = false
    if (this.panelOpen) this.scheduleClose()
  }

  private setZoneHover(v: boolean): void {
    if (this.zoneHover === v || !this.rootEl) return
    this.zoneHover = v
    this.rootEl.classList.toggle('ls-zone-hover', v)
  }

  private cancelOpen(): void {
    if (this.openTimer) {
      clearTimeout(this.openTimer)
      this.openTimer = null
    }
  }

  private cancelClose(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
  }

  private scheduleClose(): void {
    if (this.closeTimer) return
    this.closeTimer = setTimeout(
      () => this.close(),
      Math.max(0, this.settings.closeDelayMs)
    )
  }

  /* ---------------- 开关 ---------------- */

  open(): void {
    if (!this.enabled || !this.rootEl || this.disposed) return
    this.cancelOpen()
    this.cancelClose()
    if (!this.panelOpen) {
      this.panelOpen = true
      this.rootEl.classList.add('ls-open')
      this.mountedPanel?.setOpen(true)
    }
  }

  close(): void {
    this.cancelClose()
    if (this.panelOpen && this.rootEl) {
      this.panelOpen = false
      this.rootEl.classList.remove('ls-open')
      this.mountedPanel?.setOpen(false)
    }
  }

  toggle(): void {
    if (this.panelOpen) this.close()
    else this.open()
  }

  isOpen(): boolean {
    return this.panelOpen
  }

  /* ---------------- 消息 / URL 变化 ---------------- */

  private installMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (msg: ExtensionToContentMessage | BackgroundRequestLike, _sender, sendResponse) => {
        // 只处理 SW/扩展页下发给内容脚本的命令与广播；
        // 面板自己发给 SW 的请求（GET_SETTINGS 等）也会广播到本监听器，必须忽略，
        // 否则会抢先应答导致 SW 的真实响应被遮蔽。
        switch (msg.type) {
          case 'SETTINGS_CHANGED':
            void this.loadSettings().then(() => this.evaluateEnabled())
            sendResponse({ ok: true })
            break
          case 'PANEL_TOGGLE':
            if (this.enabled) this.toggle()
            sendResponse({ ok: true })
            break
          case 'PANEL_OPEN':
            if (this.enabled) this.open()
            sendResponse({ ok: true })
            break
          case 'PANEL_CLOSE':
            this.close()
            sendResponse({ ok: true })
            break
          case 'PANEL_TODO':
            // 弹窗「查看待办」：展开面板（面板内部会切到 To do 标签页）
            if (this.enabled) this.open()
            sendResponse({ ok: true })
            break
          case 'ZOOM_CHANGED':
            this.zoomFactor = msg.zoomFactor
            this.applyZoom()
            sendResponse({ ok: true })
            break
          default:
            return // 非内容脚本消息：不响应
        }
      }
    )
  }

  private installUrlChangeListener(): void {
    // SPA 前进/后退
    window.addEventListener('popstate', () => this.evaluateEnabled())
    // SPA pushState / replaceState
    const impl = this
    const originalPush = history.pushState.bind(history)
    const originalReplace = history.replaceState.bind(history)
    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      const result = originalPush(...args)
      queueMicrotask(() => impl.evaluateEnabled())
      return result
    }
    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      const result = originalReplace(...args)
      queueMicrotask(() => impl.evaluateEnabled())
      return result
    }
  }

  dispose(): void {
    this.disposed = true
    this.teardownHost()
  }
}

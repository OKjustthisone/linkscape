/** 扩展弹窗：备用入口（受保护页面提示 + 面板开关 + 管理页）。 */

import { useEffect, useState } from 'react'
import type { TabInfo } from '../shared/messages'
import { sendMessageToBackground } from '../shared/messages'
import type { ExtensionToContentMessage } from '../shared/messages'
import type { Settings } from '../shared/settings'
import { DEFAULT_SETTINGS } from '../shared/settings'
import { getExtensionPageUrl, type ExtensionPage } from '../shared/extension-pages'
import { LogoMark } from '../panel/components/Icons'

export function Popup(): JSX.Element {
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    void sendMessageToBackground<TabInfo>({ type: 'GET_TAB_INFO' })
      .then(setTabInfo)
      .catch(() => setTabInfo({ active: { isProtected: false } }))
    void sendMessageToBackground<{ settings: Settings }>({ type: 'GET_SETTINGS' })
      .then((d) => setSettings({ ...DEFAULT_SETTINGS, ...d.settings }))
      .catch(() => undefined)
  }, [])

  const sendToTab = (msg: ExtensionToContentMessage): void => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id == null) return
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {
        /* 页面无内容脚本 */
      })
    })
  }

  const openPage = (page: ExtensionPage): void => {
    void chrome.tabs.create({ url: getExtensionPageUrl(page), active: true })
  }

  const protectedPage = tabInfo?.active.isProtected ?? false

  return (
    <div className="pop-page">
      <div className="pop-header">
        <LogoMark />
        <div>
          <h1>Linkscape</h1>
          <div className="sub">液态玻璃书签面板</div>
        </div>
      </div>

      {protectedPage ? (
        <>
          <div className="pop-note">
            <strong>此页面受 Chrome 保护</strong>
            <br />
            <code>chrome://</code>、应用商店、扩展管理页等页面无法注入悬浮面板。
            请使用下方入口打开完整管理页。
          </div>
          <div className="pop-actions">
            <button className="ls-btn primary" onClick={() => openPage('manager')}>
              打开完整管理页
            </button>
            <button className="ls-btn" onClick={() => openPage('options')}>
              打开设置
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="pop-actions">
            <button className="ls-btn primary" onClick={() => sendToTab({ type: 'PANEL_TOGGLE' })}>
              打开 / 收起面板
            </button>
            <button className="ls-btn" onClick={() => openPage('manager')}>
              打开完整管理页
            </button>
            <button className="ls-btn" onClick={() => openPage('options')}>
              打开设置
            </button>
          </div>
          <div className="pop-divider" />
          <div className="pop-foot">
            鼠标移到页面{settings?.panelSide === 'right' ? '右' : '左'}边缘即可展开
            <br />
            快捷键 <code>Alt+Shift+L</code>
          </div>
        </>
      )}
    </div>
  )
}

/** 扩展弹窗：当前页面收藏 / 待办 + 面板开关 + 管理页入口。 */

import { useEffect, useMemo, useState } from 'react'
import type { TabInfo } from '../shared/messages'
import { sendMessageToBackground } from '../shared/messages'
import type { ExtensionToContentMessage } from '../shared/messages'
import type { Settings } from '../shared/settings'
import { DEFAULT_SETTINGS } from '../shared/settings'
import type { TodoItem, TodoPriority } from '../shared/todo-types'
import {
  TODO_PRIORITY_COLOR,
  TODO_PRIORITY_FULL_LABEL,
  TODO_PRIORITY_ORDER,
} from '../shared/todo-types'
import { getExtensionPageUrl, type ExtensionPage } from '../shared/extension-pages'
import { LogoMark } from '../panel/components/Icons'
import { faviconSources, urlHost } from '../shared/ui-utils'

type Status = { kind: 'ok' | 'error'; text: string } | null

export function Popup(): JSX.Element {
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [status, setStatus] = useState<Status>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void sendMessageToBackground<TabInfo>({ type: 'GET_TAB_INFO' })
      .then(setTabInfo)
      .catch(() => setTabInfo({ active: { isProtected: false } }))
    void sendMessageToBackground<{ settings: Settings }>({ type: 'GET_SETTINGS' })
      .then((d) => setSettings({ ...DEFAULT_SETTINGS, ...d.settings }))
      .catch(() => undefined)
    void sendMessageToBackground<{ todos: TodoItem[] }>({ type: 'GET_TODOS' })
      .then((d) => setTodos(d.todos))
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

  /* ---------------- 当前页面 ---------------- */

  const pageUrl = tabInfo?.active.url ?? tabInfo?.lastWebUrl ?? ''
  const pageTitle = tabInfo?.active.title?.trim() || urlHost(pageUrl)
  const canAdd = /^https?:\/\//i.test(pageUrl)
  const pendingCount = useMemo(() => todos.filter((t) => !t.done).length, [todos])

  /* ---------------- 操作 ---------------- */

  const addToFavorites = async (): Promise<void> => {
    setBusy(true)
    setStatus(null)
    try {
      await sendMessageToBackground({
        type: 'ADD_PAGE_TO_FAVORITES',
        title: pageTitle,
        url: pageUrl,
      })
      setStatus({ kind: 'ok', text: '已添加到收藏夹' })
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const addTodo = async (priority: TodoPriority): Promise<void> => {
    setBusy(true)
    setStatus(null)
    try {
      const data = await sendMessageToBackground<{ todos: TodoItem[] }>({
        type: 'ADD_TODO',
        title: pageTitle,
        url: pageUrl,
        priority,
      })
      setTodos(data.todos)
      setStatus({ kind: 'ok', text: `已添加到 To do（${TODO_PRIORITY_FULL_LABEL[priority]}）` })
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pop-page">
      <div className="pop-header">
        <LogoMark />
        <div>
          <h1>Linkscape</h1>
          <div className="sub">液态玻璃书签面板</div>
        </div>
      </div>

      {/* 当前页面 */}
      <div className="pop-page-card">
        <PageFavicon url={pageUrl} />
        <div className="pop-page-info">
          <div className="pop-page-title" title={pageTitle}>
            {pageTitle || '（无标题）'}
          </div>
          <div className="pop-page-host">
            {canAdd ? urlHost(pageUrl) : '当前页面不可收藏'}
          </div>
        </div>
      </div>

      {/* 收藏 / 待办 */}
      <div className="pop-actions">
        <button
          className="ls-btn primary"
          onClick={() => void addToFavorites()}
          disabled={!canAdd || busy}
          title={canAdd ? '把当前页面加入书签栏与收藏栏' : '当前页面不可收藏'}
        >
          <BookmarkPlusIcon />
          添加到收藏夹
        </button>

        <div className="pop-todo">
          <div className="pop-todo-label">
            <CheckIcon />
            添加到 To do
            <span className="pop-todo-count">待办 {pendingCount} 项</span>
          </div>
          <div className="pop-priority-row">
            {TODO_PRIORITY_ORDER.map((priority) => (
              <button
                key={priority}
                className="pop-priority"
                style={{ color: TODO_PRIORITY_COLOR[priority] }}
                onClick={() => void addTodo(priority)}
                disabled={!canAdd || busy}
                title={`以${TODO_PRIORITY_FULL_LABEL[priority]}记录当前页面`}
              >
                <span
                  className="pop-priority-dot"
                  style={{ background: TODO_PRIORITY_COLOR[priority] }}
                />
                {TODO_PRIORITY_FULL_LABEL[priority]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {status && (
        <div className={`pop-status ${status.kind}`} role="status">
          {status.text}
        </div>
      )}

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
          <div className="pop-divider" />
          <div className="pop-actions">
            <button className="ls-btn" onClick={() => sendToTab({ type: 'PANEL_TOGGLE' })}>
              打开 / 收起面板
            </button>
            <button className="ls-btn" onClick={() => sendToTab({ type: 'PANEL_TODO' })}>
              查看待办
            </button>
            <button className="ls-btn" onClick={() => openPage('manager')}>
              打开完整管理页
            </button>
            <button className="ls-btn" onClick={() => openPage('options')}>
              打开设置
            </button>
          </div>
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

/* ---------------- 小组件 ---------------- */

function PageFavicon({ url }: { url: string }): JSX.Element {
  const sources = faviconSources(url, 32)
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(sources.length === 0)

  useEffect(() => {
    setIndex(0)
    setFailed(sources.length === 0)
  }, [url])

  if (failed || sources.length === 0) {
    return (
      <span className="pop-favicon pop-favicon-fallback">
        <BookmarkPlusIcon />
      </span>
    )
  }
  return (
    <img
      className="pop-favicon"
      src={sources[index]}
      alt=""
      onError={() => {
        if (index + 1 < sources.length) setIndex((i) => i + 1)
        else setFailed(true)
      }}
    />
  )
}

function BookmarkPlusIcon({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 2h8a1 1 0 0 1 1 1v11l-5-3-5 3V3a1 1 0 0 1 1-1z" />
      <path d="M13.5 7.5v4M11.5 9.5h4" />
    </svg>
  )
}

function CheckIcon({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5l3.2 3.2L13 5" />
    </svg>
  )
}

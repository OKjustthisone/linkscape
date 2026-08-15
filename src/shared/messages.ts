/**
 * 消息协议：内容脚本 / 页面 <-> Service Worker。
 *
 * 方向一：内容脚本（面板）与扩展页面（manager/options）向 SW 发起请求：
 *   sendMessageToBackground<Req, Data>(req)
 * SW 统一以 { ok: true, data } | { ok: false, error } 应答。
 *
 * 方向二：SW 向内容脚本广播（书签变化、设置变化）或下发命令（打开/收起面板）：
 *   chrome.tabs.sendMessage(tabId, broadcast)
 */

import type { BookmarkTree } from './bookmark-types'
import type { Settings } from './settings'
import type { UrlStatusMap } from './url-status'

/** 内容脚本 / 扩展页面 -> SW 的请求。 */
export type BackgroundRequest =
  | { type: 'GET_BOOKMARKS_TREE' }
  | { type: 'GET_FAVORITES' }
  | { type: 'TOGGLE_FAVORITE'; id: string }
  | { type: 'CREATE_BOOKMARK'; parentId: string; title: string; url: string; index?: number }
  | { type: 'CREATE_FOLDER'; parentId: string; title: string; index?: number }
  | { type: 'RENAME_NODE'; id: string; title: string }
  | { type: 'REMOVE_NODES'; ids: string[] }
  | { type: 'GET_LAST_REMOVED' }
  | { type: 'UNDO_LAST_REMOVED' }
  | { type: 'MOVE_NODES'; ids: string[]; parentId: string; index?: number }
  | { type: 'COPY_NODES'; ids: string[]; parentId: string }
  | { type: 'OPEN_IN_BACKGROUND'; url: string }
  | { type: 'OPEN_EXTENSION_PAGE'; page: 'manager' | 'options' }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<Settings> }
  | { type: 'GET_TAB_INFO' }
  | { type: 'GET_TAB_ZOOM' }
  | { type: 'GET_URL_STATUSES' }
  | { type: 'TEST_BOOKMARK_URLS'; ids?: string[] }

export type BackgroundResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

/** SW 下发给内容脚本的广播 / 命令。 */
export type ExtensionToContentMessage =
  | { type: 'BOOKMARKS_CHANGED' }
  | { type: 'SETTINGS_CHANGED' }
  | { type: 'PANEL_TOGGLE' }
  | { type: 'PANEL_OPEN' }
  | { type: 'PANEL_CLOSE' }
  | { type: 'ZOOM_CHANGED'; zoomFactor: number }

/** SW 下发给扩展页面（manager/options）的广播。 */
export type ExtensionToPageMessage =
  | { type: 'BOOKMARKS_CHANGED' }
  | { type: 'SETTINGS_CHANGED' }

export interface TabInfo {
  /** 当前活动标签页（弹窗场景下即用户正在浏览的页面）。 */
  active: {
    url?: string
    title?: string
    isProtected: boolean
  }
  /** SW 记录的最近一个普通网页 URL（设置页等扩展页面打开时仍可用）。 */
  lastWebUrl?: string
}

export interface TreeResponse {
  tree: BookmarkTree
}

export interface UrlStatusesResponse {
  statuses: UrlStatusMap
}

export interface UrlTestResponse {
  results: UrlStatusMap
}

/** 最近一次删除的快照（用于撤销）。 */
export interface RemovedSnapshotItem {
  node: BookmarkTree[number]
  parentId?: string
  index?: number
}

export interface RemovedSnapshot {
  nodes: RemovedSnapshotItem[]
  timestamp: number
}

export type FavoritesResponse = { favorites: string[] }

/** 带类型封装：内容脚本 / 页面 向 SW 发请求。 */
export function sendMessageToBackground<T = unknown>(
  req: BackgroundRequest
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(req, (res: BackgroundResponse<T> | undefined) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message))
        return
      }
      if (!res) {
        reject(new Error('Service Worker 无响应'))
        return
      }
      if (res.ok) resolve(res.data)
      else reject(new Error(res.error))
    })
  })
}

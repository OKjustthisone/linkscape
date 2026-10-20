/**
 * Linkscape Service Worker（MV3，ES Module）。
 *
 * 职责：
 *  - 唯一访问 chrome.bookmarks 的地方（内容脚本没有 bookmarks 权限）
 *  - 收藏栏（chrome.storage.local "favorites"）
 *  - 设置读写（chrome.storage.local "settings"）
 *  - 后台开标签页（active: false）
 *  - 书签变化监听 + 多界面广播
 *  - 快捷键 / 面板开关命令
 */

import type { BookmarkNode, BookmarkTree } from '../shared/bookmark-types'
import { isFolder, isSpecialRootId } from '../shared/bookmark-types'
import type {
  BackgroundRequest,
  ExtensionToContentMessage,
  ExtensionToPageMessage,
  RemovedSnapshot,
  TabInfo,
} from '../shared/messages'
import {
  DEFAULT_SETTINGS,
  FAVORITES_KEY,
  SETTINGS_KEY,
  mergeSettings,
  type Settings,
} from '../shared/settings'
import {
  createTodoId,
  normalizeTodoPriority,
  sanitizeTodoItems,
  TODO_STORAGE_KEY,
  type TodoItem,
  type TodoPatch,
  type TodoPriority,
} from '../shared/todo-types'
import { checkMove, indexById } from '../shared/tree-utils'
import { isProtectedUrl } from '../shared/url-matcher'
import { getExtensionPageUrl } from '../shared/extension-pages'
import type { UrlCheckResult, UrlStatusMap } from '../shared/url-status'

/* ------------------------------------------------------------------ */
/* 存储辅助                                                             */
/* ------------------------------------------------------------------ */

const LAST_REMOVED_KEY = 'lastRemoved'
const URL_STATUS_KEY = 'urlStatuses'
const URL_TEST_TIMEOUT_MS = 8000
const URL_TEST_CONCURRENCY = 6

async function readSettings(): Promise<Settings> {
  const { [SETTINGS_KEY]: settings } = await chrome.storage.local.get(SETTINGS_KEY)
  return settings ? { ...DEFAULT_SETTINGS, ...settings } : { ...DEFAULT_SETTINGS }
}

async function readFavorites(): Promise<string[]> {
  const { [FAVORITES_KEY]: favorites } = await chrome.storage.local.get(FAVORITES_KEY)
  return Array.isArray(favorites) ? favorites : []
}

/** 过滤失效收藏（书签已被外部删除）。 */
async function pruneFavorites(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const results = await Promise.allSettled(ids.map((id) => chrome.bookmarks.get(id)))
  return ids.filter((_, i) => results[i].status === 'fulfilled')
}

async function saveFavorites(ids: string[]): Promise<void> {
  await chrome.storage.local.set({ [FAVORITES_KEY]: ids })
}

async function readUrlStatuses(): Promise<UrlStatusMap> {
  const { [URL_STATUS_KEY]: statuses } = await chrome.storage.local.get(URL_STATUS_KEY)
  if (!statuses || typeof statuses !== 'object' || Array.isArray(statuses)) return {}
  return statuses as UrlStatusMap
}

async function saveUrlStatuses(statuses: UrlStatusMap): Promise<void> {
  await chrome.storage.local.set({ [URL_STATUS_KEY]: statuses })
}

/* ------------------------------------------------------------------ */
/* 书签操作                                                             */
/* ------------------------------------------------------------------ */

function getTree(): Promise<BookmarkTree> {
  return chrome.bookmarks.getTree()
}

async function createBookmark(
  parentId: string,
  title: string,
  url: string,
  index?: number
): Promise<void> {
  if (!url) throw new Error('书签地址不能为空')
  await chrome.bookmarks.create({ parentId, title: title.trim() || url, url, index })
}

async function createFolder(parentId: string, title: string): Promise<void> {
  if (!title.trim()) throw new Error('文件夹名称不能为空')
  await chrome.bookmarks.create({ parentId, title: title.trim() })
}

async function renameNode(id: string, title: string): Promise<void> {
  if (isSpecialRootId(id)) throw new Error('不能重命名 Chrome 特殊根文件夹')
  if (!title.trim()) throw new Error('名称不能为空')
  await chrome.bookmarks.update(id, { title: title.trim() })
}

async function removeNodes(ids: string[]): Promise<void> {
  // 删除前先记录快照（供短时间内的「撤销」恢复）
  const removed: RemovedSnapshot['nodes'] = []
  for (const id of ids) {
    if (isSpecialRootId(id)) throw new Error('不能删除 Chrome 特殊根文件夹')
    const [node] = await chrome.bookmarks.get(id)
    if (!node) continue
    const [sub] = await chrome.bookmarks.getSubTree(id)
    if (sub) {
      removed.push({ node: sub, parentId: node.parentId, index: node.index })
    }
    if (isFolder(node)) await chrome.bookmarks.removeTree(id)
    else await chrome.bookmarks.remove(id)
  }
  if (removed.length > 0) {
    const snapshot: RemovedSnapshot = { nodes: removed, timestamp: Date.now() }
    await chrome.storage.local.set({ [LAST_REMOVED_KEY]: snapshot })
  }
  // 清理收藏栏中失效的 id
  const favorites = await pruneFavorites(await readFavorites())
  await saveFavorites(favorites)
}

async function getLastRemoved(): Promise<RemovedSnapshot | null> {
  const { [LAST_REMOVED_KEY]: snapshot } = await chrome.storage.local.get(LAST_REMOVED_KEY)
  return snapshot ?? null
}

async function recreateNode(
  node: BookmarkNode,
  parentId: string | undefined,
  index: number | undefined
): Promise<void> {
  if (!parentId) return
  if (node.url !== undefined) {
    await chrome.bookmarks.create({
      parentId,
      title: node.title,
      url: node.url,
      index,
    })
  } else {
    const folder = await chrome.bookmarks.create({
      parentId,
      title: node.title || '新建文件夹',
      index,
    })
    for (const child of node.children ?? []) {
      await recreateNode(child, folder.id, undefined)
    }
  }
}

async function undoLastRemoved(): Promise<void> {
  const snapshot = await getLastRemoved()
  if (!snapshot || snapshot.nodes.length === 0) return
  for (const item of snapshot.nodes) {
    await recreateNode(item.node, item.parentId, item.index)
  }
  await chrome.storage.local.remove(LAST_REMOVED_KEY)
  notifyBookmarksChanged()
}

async function moveNodes(
  ids: string[],
  parentId: string,
  index?: number
): Promise<void> {
  const tree = await getTree()
  const check = checkMove(tree, ids, parentId)
  if (!check.ok) throw new Error(check.reason ?? '移动失败')
  for (const id of ids) {
    await chrome.bookmarks.move(id, { parentId, index })
  }
}

async function copyNodeInto(node: BookmarkNode, destParentId: string): Promise<void> {
  if (node.url !== undefined) {
    await chrome.bookmarks.create({
      parentId: destParentId,
      title: node.title,
      url: node.url,
    })
  } else {
    const folder = await chrome.bookmarks.create({
      parentId: destParentId,
      title: node.title || '新建文件夹',
    })
    for (const child of node.children ?? []) {
      await copyNodeInto(child, folder.id)
    }
  }
}

async function copyNodes(ids: string[], parentId: string): Promise<void> {
  const tree = await getTree()
  const byId = indexById(tree)
  const dest = byId.get(parentId)
  if (!dest || !isFolder(dest)) throw new Error('目标不是文件夹')
  for (const id of ids) {
    const [sub] = await chrome.bookmarks.getSubTree(id)
    if (!sub) continue
    await copyNodeInto(sub, parentId)
  }
}

async function toggleFavorite(id: string): Promise<string[]> {
  const current = await readFavorites()
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id]
  await saveFavorites(next)
  return next
}

/* ------------------------------------------------------------------ */
/* To do 待办                                                          */
/* ------------------------------------------------------------------ */

async function readTodos(): Promise<TodoItem[]> {
  const { [TODO_STORAGE_KEY]: todos } = await chrome.storage.local.get(TODO_STORAGE_KEY)
  return sanitizeTodoItems(todos)
}

async function saveTodos(todos: TodoItem[]): Promise<void> {
  await chrome.storage.local.set({ [TODO_STORAGE_KEY]: todos })
}

async function addTodo(
  title: string,
  url: string,
  priority: TodoPriority
): Promise<TodoItem[]> {
  if (!url.trim()) throw new Error('网址不能为空')
  const todos = await readTodos()
  const item: TodoItem = {
    id: createTodoId(),
    title: title.trim() || url,
    url: url.trim(),
    priority: normalizeTodoPriority(priority),
    done: false,
    createdAt: Date.now(),
  }
  const next = [item, ...todos]
  await saveTodos(next)
  notifyTodosChanged()
  return next
}

async function updateTodo(id: string, patch: TodoPatch): Promise<TodoItem[]> {
  const todos = await readTodos()
  const next = todos.map((todo) => {
    if (todo.id !== id) return todo
    return {
      ...todo,
      ...(patch.title !== undefined ? { title: patch.title.trim() || todo.title } : {}),
      ...(patch.url !== undefined ? { url: patch.url.trim() || todo.url } : {}),
      ...(patch.priority !== undefined
        ? { priority: normalizeTodoPriority(patch.priority, todo.priority) }
        : {}),
      ...(patch.done !== undefined ? { done: patch.done } : {}),
    }
  })
  if (next.every((todo, i) => todo === todos[i])) return todos
  await saveTodos(next)
  notifyTodosChanged()
  return next
}

async function removeTodo(id: string): Promise<TodoItem[]> {
  const todos = await readTodos()
  const next = todos.filter((todo) => todo.id !== id)
  if (next.length === todos.length) return todos
  await saveTodos(next)
  notifyTodosChanged()
  return next
}

async function clearDoneTodos(): Promise<TodoItem[]> {
  const todos = await readTodos()
  const next = todos.filter((todo) => !todo.done)
  if (next.length === todos.length) return todos
  await saveTodos(next)
  notifyTodosChanged()
  return next
}

/* ------------------------------------------------------------------ */
/* 当前页面加入收藏夹                                                  */
/* ------------------------------------------------------------------ */

/** 书签树中第一个 URL 相同的书签。 */
function findBookmarkByUrl(nodes: BookmarkTree, url: string): BookmarkNode | undefined {
  for (const node of nodes) {
    if (node.url === url) return node
    if (node.children) {
      const found = findBookmarkByUrl(node.children, url)
      if (found) return found
    }
  }
  return undefined
}

/** 收藏落点：优先 Chrome 的「书签栏」，否则用第一个根目录。 */
function resolveFavoritesParentId(tree: BookmarkTree): string {
  const roots = tree[0]?.children ?? []
  const bar = roots.find((root) => /bookmarks bar|书签栏/i.test(root.title ?? ''))
  return bar?.id ?? roots[0]?.id ?? '1'
}

/**
 * 把当前页面加入收藏：
 * 1. 书签树中已有同地址书签时直接复用，避免重复；
 * 2. 否则在「书签栏」新建书签；
 * 3. 最后加入 Linkscape 的收藏栏（面板内「收藏栏」标签页可见）。
 */
async function addPageToFavorites(
  title: string,
  url: string
): Promise<{ id: string; created: boolean }> {
  if (!/^https?:\/\//i.test(url)) throw new Error('当前页面不是可收藏的网页')
  const tree = await getTree()
  const existing = findBookmarkByUrl(tree, url)
  let id = existing?.id
  let created = false
  if (!id) {
    const parentId = resolveFavoritesParentId(tree)
    const node = await chrome.bookmarks.create({
      parentId,
      title: title.trim() || url,
      url,
    })
    id = node.id
    created = true
  }
  const favorites = await readFavorites()
  if (!favorites.includes(id)) {
    await saveFavorites([...favorites, id])
  }
  return { id, created }
}

/* ------------------------------------------------------------------ */
/* URL 可用性检测                                                      */
/* ------------------------------------------------------------------ */

function collectBookmarkNodes(nodes: BookmarkTree): BookmarkNode[] {
  const result: BookmarkNode[] = []
  const walk = (items: BookmarkNode[]): void => {
    for (const node of items) {
      if (node.url !== undefined) result.push(node)
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
  return result
}

async function fetchForUrlCheck(url: string, method: 'HEAD' | 'GET'): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), URL_TEST_TIMEOUT_MS)
  try {
    return await fetch(url, {
      method,
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

function classifyHttpStatus(status: number): UrlCheckResult['status'] {
  if (status >= 200 && status < 400) return 'valid'
  // 需要登录、权限或稍后重试，说明地址本身仍然可达，不标记为失效。
  if ([401, 403, 405, 408, 429].includes(status) || status >= 500) return 'unknown'
  return 'invalid'
}

async function testBookmarkUrl(node: BookmarkNode): Promise<UrlCheckResult> {
  const checkedAt = Date.now()
  const base = { id: node.id, url: node.url ?? '', checkedAt }
  if (!node.url || !/^https?:\/\//i.test(node.url)) {
    return { ...base, status: 'unknown', reason: '仅支持 HTTP / HTTPS 地址' }
  }

  try {
    let response = await fetchForUrlCheck(node.url, 'HEAD')
    if (response.status === 405 || response.status === 501) {
      response.body?.cancel()
      response = await fetchForUrlCheck(node.url, 'GET')
    }
    const status = classifyHttpStatus(response.status)
    const result: UrlCheckResult = {
      ...base,
      status,
      statusCode: response.status,
      reason: status === 'valid' ? undefined : `HTTP ${response.status}`,
    }
    response.body?.cancel()
    return result
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
    return {
      ...base,
      status: 'unknown',
      reason: name === 'AbortError' ? '请求超时' : '网络错误或跨域限制',
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = []
  let cursor = 0
  const run = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  )
  return results
}

async function testBookmarkUrls(ids?: string[]): Promise<{ results: UrlStatusMap }> {
  const tree = await getTree()
  const byId = indexById(tree)
  const nodes = ids
    ? ids.map((id) => byId.get(id)).filter((node): node is BookmarkNode => !!node?.url)
    : collectBookmarkNodes(tree)
  const results = await mapWithConcurrency(nodes, testBookmarkUrl, URL_TEST_CONCURRENCY)
  const resultMap: UrlStatusMap = {}
  for (const result of results) resultMap[result.id] = result
  await saveUrlStatuses({ ...(await readUrlStatuses()), ...resultMap })
  return { results: resultMap }
}

async function clearUrlStatus(id: string): Promise<void> {
  const statuses = await readUrlStatuses()
  if (!statuses[id]) return
  delete statuses[id]
  await saveUrlStatuses(statuses)
}

/* ------------------------------------------------------------------ */
/* 广播                                                                */
/* ------------------------------------------------------------------ */

async function broadcastToTabs(msg: ExtensionToContentMessage): Promise<void> {
  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (tab.id == null) continue
    chrome.tabs.sendMessage(tab.id, msg).catch(() => {
      /* 页面没有内容脚本时忽略 */
    })
  }
}

function notifyBookmarksChanged(): void {
  void broadcastToTabs({ type: 'BOOKMARKS_CHANGED' })
}

/** 待办变化：同时通知内容脚本（面板）与扩展页面（管理页 / 弹窗）。 */
function notifyTodosChanged(): void {
  void broadcastToTabs({ type: 'TODOS_CHANGED' })
  void chrome.runtime
    .sendMessage({ type: 'TODOS_CHANGED' } satisfies ExtensionToPageMessage)
    .catch(() => {
      /* 没有扩展页面在监听时忽略 */
    })
}

/* ------------------------------------------------------------------ */
/* 消息路由                                                            */
/* ------------------------------------------------------------------ */

async function handleRequest(
  req: BackgroundRequest,
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (req.type) {
    case 'GET_BOOKMARKS_TREE':
      return { tree: await getTree() }

    case 'GET_FAVORITES': {
      const favorites = await pruneFavorites(await readFavorites())
      if (favorites.length !== (await readFavorites()).length) {
        await saveFavorites(favorites)
      }
      return { favorites }
    }

    case 'TOGGLE_FAVORITE':
      return { favorites: await toggleFavorite(req.id) }

    case 'CREATE_BOOKMARK':
      await createBookmark(req.parentId, req.title, req.url, req.index)
      return {}

    case 'CREATE_FOLDER':
      await createFolder(req.parentId, req.title)
      return {}

    case 'RENAME_NODE':
      await renameNode(req.id, req.title)
      return {}

    case 'REMOVE_NODES':
      await removeNodes(req.ids)
      return {}

    case 'GET_LAST_REMOVED':
      return { snapshot: await getLastRemoved() }

    case 'UNDO_LAST_REMOVED':
      await undoLastRemoved()
      return {}

    case 'MOVE_NODES':
      await moveNodes(req.ids, req.parentId, req.index)
      return {}

    case 'COPY_NODES':
      await copyNodes(req.ids, req.parentId)
      return {}

    case 'OPEN_IN_BACKGROUND':
      await chrome.tabs.create({ url: req.url, active: false })
      return {}

    case 'OPEN_EXTENSION_PAGE':
      await chrome.tabs.create({
        url: getExtensionPageUrl(req.page),
        active: true,
      })
      return {}

    case 'GET_SETTINGS':
      return { settings: await readSettings() }

    case 'UPDATE_SETTINGS': {
      const current = await readSettings()
      const next = mergeSettings(current, req.patch)
      await chrome.storage.local.set({ [SETTINGS_KEY]: next })
      return { settings: next }
    }

    case 'GET_TAB_INFO': {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      })
      const info: TabInfo = {
        active: {
          url: tab?.url,
          title: tab?.title,
          isProtected: isProtectedUrl(tab?.url),
        },
        lastWebUrl,
      }
      return info
    }

    case 'GET_TAB_ZOOM': {
      const tabId = sender.tab?.id
      if (tabId == null) return { zoomFactor: 1 }
      return { zoomFactor: await chrome.tabs.getZoom(tabId) }
    }

    case 'GET_URL_STATUSES':
      return { statuses: await readUrlStatuses() }

    case 'TEST_BOOKMARK_URLS':
      return await testBookmarkUrls(req.ids)

    case 'ADD_PAGE_TO_FAVORITES':
      return await addPageToFavorites(req.title, req.url)

    case 'GET_TODOS':
      return { todos: await readTodos() }

    case 'ADD_TODO':
      return { todos: await addTodo(req.title, req.url, req.priority) }

    case 'UPDATE_TODO':
      return { todos: await updateTodo(req.id, req.patch) }

    case 'REMOVE_TODO':
      return { todos: await removeTodo(req.id) }

    case 'CLEAR_DONE_TODOS':
      return { todos: await clearDoneTodos() }

    default:
      throw new Error(`未知消息类型: ${(req as { type: string }).type}`)
  }
}

chrome.runtime.onMessage.addListener(
  (req: BackgroundRequest, sender, sendResponse) => {
    // SW 自己发出的广播（BOOKMARKS_CHANGED / TODOS_CHANGED 等）不是请求，直接忽略。
    if (!req || typeof req.type !== 'string' || req.type.endsWith('_CHANGED')) return
    handleRequest(req, sender)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        })
      )
    return true // 异步应答
  }
)

/* ------------------------------------------------------------------ */
/* 最近网页 URL 追踪（供设置页「添加当前网站」使用）                      */
/* ------------------------------------------------------------------ */

let lastWebUrl: string | undefined

function isWebUrl(url: string | undefined): boolean {
  return !!url && (url.startsWith('http://') || url.startsWith('https://'))
}

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (isWebUrl(changeInfo.url)) lastWebUrl = changeInfo.url
})

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (isWebUrl(tab.url)) lastWebUrl = tab.url
  } catch {
    /* 标签页可能已被关闭 */
  }
})

chrome.tabs.onZoomChange.addListener(({ tabId, newZoomFactor }) => {
  chrome.tabs.sendMessage(tabId, {
    type: 'ZOOM_CHANGED',
    zoomFactor: newZoomFactor,
  } as ExtensionToContentMessage).catch(() => {
    /* 标签页没有内容脚本时忽略 */
  })
})

/* ------------------------------------------------------------------ */
/* 书签变化同步                                                        */
/* ------------------------------------------------------------------ */

chrome.bookmarks.onCreated.addListener(notifyBookmarksChanged)
chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
  notifyBookmarksChanged()
  if (changeInfo.url !== undefined) void clearUrlStatus(id)
})
chrome.bookmarks.onMoved.addListener(notifyBookmarksChanged)

chrome.bookmarks.onRemoved.addListener(async (_id, _removeInfo) => {
  notifyBookmarksChanged()
  await clearUrlStatus(_id)
  const favorites = await pruneFavorites(await readFavorites())
  await saveFavorites(favorites)
})

/* ------------------------------------------------------------------ */
/* 设置变化广播                                                        */
/* ------------------------------------------------------------------ */

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes[SETTINGS_KEY]) {
    void broadcastToTabs({ type: 'SETTINGS_CHANGED' })
  }
})

/* ------------------------------------------------------------------ */
/* 生命周期与命令                                                       */
/* ------------------------------------------------------------------ */

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.get(SETTINGS_KEY).then(({ [SETTINGS_KEY]: settings }) => {
    if (!settings) {
      void chrome.storage.local.set({ [SETTINGS_KEY]: { ...DEFAULT_SETTINGS } })
    }
  })
  void chrome.storage.local.get(FAVORITES_KEY).then(({ [FAVORITES_KEY]: favs }) => {
    if (!Array.isArray(favs)) {
      void chrome.storage.local.set({ [FAVORITES_KEY]: [] })
    }
  })
  void chrome.storage.local.get(TODO_STORAGE_KEY).then(({ [TODO_STORAGE_KEY]: todos }) => {
    if (!Array.isArray(todos)) {
      void chrome.storage.local.set({ [TODO_STORAGE_KEY]: [] })
    }
  })
})

chrome.commands.onCommand.addListener((command) => {
  if (command !== 'toggle-panel') return
  void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (tab?.id == null) return
    chrome.tabs.sendMessage(tab.id, { type: 'PANEL_TOGGLE' } as ExtensionToContentMessage).catch(() => {
      /* 受保护页面无内容脚本 */
    })
  })
})

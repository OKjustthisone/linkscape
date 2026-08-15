/**
 * 面板数据层：书签树 / 收藏栏 / 设置 的统一状态与操作。
 * 所有 chrome.bookmarks 调用都经由 Service Worker。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookmarkTree, BookmarkNode } from '../shared/bookmark-types'
import type { ExtensionToContentMessage } from '../shared/messages'
import { sendMessageToBackground } from '../shared/messages'
import {
  DEFAULT_SETTINGS,
  type Settings,
} from '../shared/settings'
import { computePaths, countNodes } from '../shared/tree-utils'
import { SearchIndex, type SearchResult } from '../shared/search-index'

export interface BookmarkActions {
  createBookmark: (parentId: string, title: string, url: string) => Promise<void>
  createFolder: (parentId: string, title: string) => Promise<void>
  renameNode: (id: string, title: string) => Promise<void>
  removeNodes: (ids: string[]) => Promise<void>
  moveNodes: (ids: string[], parentId: string, index?: number) => Promise<void>
  copyNodes: (ids: string[], parentId: string) => Promise<void>
  toggleFavorite: (id: string) => Promise<void>
  openInBackground: (url: string) => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
}

export interface PanelData {
  tree: BookmarkTree
  favorites: string[]
  settings: Settings
  loading: boolean
  error: string | null
  paths: Map<string, string>
  counts: { bookmarks: number; folders: number }
  searchIndex: SearchIndex
  /** 搜索（内部带缓存）。 */
  search: (query: string) => SearchResult[]
  actions: BookmarkActions
  refresh: () => Promise<void>
}

export function usePanelData(): PanelData {
  const [tree, setTree] = useState<BookmarkTree>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [{ tree: t }, favData, setData] = await Promise.all([
        sendMessageToBackground<{ tree: BookmarkTree }>({ type: 'GET_BOOKMARKS_TREE' }),
        sendMessageToBackground<{ favorites: string[] }>({ type: 'GET_FAVORITES' }),
        sendMessageToBackground<{ settings: Settings }>({ type: 'GET_SETTINGS' }),
      ])
      setTree(t)
      setFavorites(favData.favorites)
      setSettings({ ...DEFAULT_SETTINGS, ...setData.settings })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // SW 广播：书签 / 设置变化
  useEffect(() => {
    const onMessage = (msg: ExtensionToContentMessage): void => {
      if (msg.type === 'BOOKMARKS_CHANGED') void refresh()
      else if (msg.type === 'SETTINGS_CHANGED') void refresh()
    }
    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [refresh])

  const run = useCallback(
    async <T,>(p: Promise<T>): Promise<void> => {
      setError(null)
      try {
        await p
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        throw e
      }
    },
    [refresh]
  )

  const actions: BookmarkActions = useMemo(
    () => ({
      createBookmark: (parentId, title, url) =>
        run(sendMessageToBackground({ type: 'CREATE_BOOKMARK', parentId, title, url })),
      createFolder: (parentId, title) =>
        run(sendMessageToBackground({ type: 'CREATE_FOLDER', parentId, title })),
      renameNode: (id, title) =>
        run(sendMessageToBackground({ type: 'RENAME_NODE', id, title })),
      removeNodes: (ids) =>
        run(sendMessageToBackground({ type: 'REMOVE_NODES', ids })),
      moveNodes: (ids, parentId, index) =>
        run(sendMessageToBackground({ type: 'MOVE_NODES', ids, parentId, index })),
      copyNodes: (ids, parentId) =>
        run(sendMessageToBackground({ type: 'COPY_NODES', ids, parentId })),
      toggleFavorite: (id) =>
        run(
          sendMessageToBackground<{ favorites: string[] }>({
            type: 'TOGGLE_FAVORITE',
            id,
          }).then((d) => setFavorites(d.favorites))
        ),
      openInBackground: (url) =>
        run(sendMessageToBackground({ type: 'OPEN_IN_BACKGROUND', url })),
      updateSettings: (patch) =>
        run(
          sendMessageToBackground<{ settings: Settings }>({
            type: 'UPDATE_SETTINGS',
            patch,
          }).then((d) => setSettings(d.settings))
        ),
    }),
    [run]
  )

  const paths = useMemo(() => computePaths(tree), [tree])
  const counts = useMemo(() => countNodes(tree), [tree])

  const searchIndex = useMemo(() => {
    const index = new SearchIndex()
    const items: {
      id: string
      title: string
      url?: string
      path: string
    }[] = []
    const walk = (nodes: BookmarkNode[], prefix: string): void => {
      for (const node of nodes) {
        if (node.url !== undefined) {
          items.push({
            id: node.id,
            title: node.title,
            url: node.url,
            path: paths.get(node.id) ?? prefix,
          })
        }
        if (node.children) walk(node.children, prefix)
      }
    }
    walk(tree, '')
    index.build(items)
    return index
  }, [tree, paths])

  const _searchCache = useRef<{
    index: SearchIndex
    query: string
    results: SearchResult[]
  } | null>(null)
  const search = useCallback(
    (query: string): SearchResult[] => {
      const q = query.trim()
      const cache = _searchCache.current
      if (cache && cache.index === searchIndex && cache.query === q) {
        return cache.results
      }
      const results = q ? searchIndex.search(q) : []
      _searchCache.current = { index: searchIndex, query: q, results }
      return results
    },
    [searchIndex]
  )

  return {
    tree,
    favorites,
    settings,
    loading,
    error,
    paths,
    counts,
    searchIndex,
    search,
    actions,
    refresh,
  }
}

export type { SearchResult }

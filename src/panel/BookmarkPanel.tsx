/** Linkscape 悬浮面板主组件。 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookmarkNode } from '../shared/bookmark-types'
import { isSpecialRootId } from '../shared/bookmark-types'
import { indexById } from '../shared/tree-utils'
import { sendMessageToBackground } from '../shared/messages'
import { usePanelData } from './panel-state'
import { useUndo } from './use-undo'
import { TreeView } from './components/TreeView'
import { FavoritesView } from './components/FavoritesView'
import { SearchView } from './components/SearchView'
import { RowMenu } from './components/RowMenu'
import { Dialogs } from './components/Dialogs'
import { CloseIcon, ExternalIcon, GearIcon, LogoMark, SearchIcon } from './components/Icons'
import type { DropPosition, DropTarget } from './components/BookmarkRow'
import type { DialogState, MenuAnchor, NodeAction } from './types'

export interface BookmarkPanelProps {
  /** 是否处于打开状态（由 edge-host 通知）。 */
  open: boolean
  onClose: () => void
}

const SEARCH_DEBOUNCE_MS = 120

function getDropPosition(
  node: BookmarkNode,
  event: React.DragEvent<HTMLDivElement>
): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0.5
  // 文件夹中部表示“放入”，上下区域仍可用于同级排序。
  if (node.url === undefined && ratio > 0.25 && ratio < 0.75) return 'inside'
  return ratio < 0.5 ? 'before' : 'after'
}

export function BookmarkPanel({ open, onClose }: BookmarkPanelProps): JSX.Element {
  const data = usePanelData()
  const { actions, tree, favorites, counts, error, loading } = data

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [view, setView] = useState<'favorites' | 'tree'>('tree')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const { undoInfo, afterDelete, undo, dismissUndo } = useUndo()

  const searchRef = useRef<HTMLInputElement>(null)
  const emptySelection = useMemo(() => new Set<string>(), [])

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const favoritesSet = useMemo(() => new Set(favorites), [favorites])
  const byId = useMemo(() => indexById(tree), [tree])

  // 树视图默认展开三个特殊根
  useEffect(() => {
    setExpanded((prev) => {
      const roots = tree[0]?.children?.map((c) => c.id) ?? []
      const next = new Set(prev)
      for (const r of roots) next.add(r)
      return next
    })
  }, [tree])

  const showSearch = debouncedQuery.trim().length > 0
  const searchResults = useMemo(
    () => (showSearch ? data.search(debouncedQuery) : []),
    [data, showSearch, debouncedQuery]
  )

  /* ---------------- 打开 / 收起快捷键 ---------------- */

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      // Ctrl/Cmd+F 聚焦搜索
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        e.stopPropagation()
        searchRef.current?.focus()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (dialog) setDialog(null)
        else if (menu) setMenu(null)
        else if (query) setQuery('')
        else onClose()
        return
      }
      // 搜索结果键盘导航
      if (showSearch && searchResults.length > 0) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          setActiveId((prev) => {
            const idx = prev ? searchResults.findIndex((r) => r.id === prev) : -1
            const delta = e.key === 'ArrowDown' ? 1 : -1
            const next = (idx + delta + searchResults.length) % searchResults.length
            return searchResults[next]?.id ?? null
          })
        } else if (e.key === 'Enter' && activeId) {
          e.preventDefault()
          const node = byId.get(activeId)
          if (node?.url) void actions.openInBackground(node.url)
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, dialog, menu, query, showSearch, searchResults, activeId, byId, actions, onClose])

  /* ---------------- 行操作 ---------------- */

  const handleAction = useCallback(
    (action: NodeAction, node: BookmarkNode): void => {
      switch (action) {
        case 'open':
          if (node.url) void actions.openInBackground(node.url)
          break
        case 'toggle-favorite':
          void actions.toggleFavorite(node.id)
          break
        case 'rename':
          setDialog({ kind: 'rename', node })
          break
        case 'move':
          setDialog({ kind: 'move', ids: [node.id], mode: 'move' })
          break
        case 'copy':
          setDialog({ kind: 'move', ids: [node.id], mode: 'copy' })
          break
        case 'delete':
          setDialog({ kind: 'confirm-delete', ids: [node.id] })
          break
        case 'new-bookmark':
          setDialog({ kind: 'new-bookmark', parentId: node.id })
          break
        case 'new-folder':
          setDialog({ kind: 'new-folder', parentId: node.id })
          break
      }
    },
    [actions]
  )

  const handleOpen = useCallback(
    (node: BookmarkNode): void => {
      if (node.url) void actions.openInBackground(node.url)
    },
    [actions]
  )

  const handleDialogSubmit = useCallback(
    async (d: DialogState, values: Record<string, string>): Promise<void> => {
      switch (d.kind) {
        case 'rename':
          await actions.renameNode(d.node.id, values.title || d.node.title)
          break
        case 'new-bookmark':
          await actions.createBookmark(d.parentId, values.title, values.url)
          break
        case 'new-folder':
          await actions.createFolder(d.parentId, values.title)
          break
        case 'move': {
          if (!values.destId) throw new Error('请选择目标文件夹')
          if (d.mode === 'move') await actions.moveNodes(d.ids, values.destId)
          else await actions.copyNodes(d.ids, values.destId)
          break
        }
        case 'confirm-delete':
          await actions.removeNodes(d.ids)
          await afterDelete()
          break
      }
    },
    [actions, afterDelete]
  )

  const openExtensionPage = (page: 'manager' | 'options'): void => {
    void sendOpenPage(page)
  }

  const topLevel = useMemo(() => tree[0]?.children ?? [], [tree])

  /* ---------------- 侧面板拖拽排序 ---------------- */

  const clearDrag = useCallback((): void => {
    setDraggingId(null)
    setDropTarget(null)
  }, [])

  const targetIsDescendant = useCallback(
    (targetId: string, ancestorId: string): boolean => {
      let current = byId.get(targetId)
      while (current?.parentId) {
        if (current.parentId === ancestorId) return true
        current = byId.get(current.parentId)
      }
      return false
    },
    [byId]
  )

  const handleDragStart = useCallback(
    (node: BookmarkNode, event: React.DragEvent<HTMLElement>): void => {
      if (isSpecialRootId(node.id)) return
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', node.id)
      setDraggingId(node.id)
      setDropTarget(null)
    },
    []
  )

  const handleDragOver = useCallback(
    (node: BookmarkNode, event: React.DragEvent<HTMLDivElement>): void => {
      if (!draggingId || node.id === draggingId || targetIsDescendant(node.id, draggingId)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      const position = getDropPosition(node, event)
      setDropTarget((prev) =>
        prev?.id === node.id && prev.position === position ? prev : { id: node.id, position }
      )
    },
    [draggingId, targetIsDescendant]
  )

  const handleDrop = useCallback(
    async (node: BookmarkNode, event: React.DragEvent<HTMLDivElement>): Promise<void> => {
      if (!draggingId || node.id === draggingId || targetIsDescendant(node.id, draggingId)) return
      event.preventDefault()
      const dragged = byId.get(draggingId)
      if (!dragged) {
        clearDrag()
        return
      }

      const fallbackPosition = getDropPosition(node, event)
      const position = dropTarget?.id === node.id ? dropTarget.position : fallbackPosition
      let parentId: string
      let index: number | undefined

      if (position === 'inside') {
        parentId = node.id
      } else {
        parentId = node.parentId ?? ''
        index = (node.index ?? 0) + (position === 'after' ? 1 : 0)
      }

      clearDrag()
      if (!parentId) return
      try {
        await actions.moveNodes([dragged.id], parentId, index)
      } catch {
        // 面板数据层会显示具体错误；这里仅负责结束拖拽态。
      }
    },
    [actions, byId, clearDrag, draggingId, dropTarget, targetIsDescendant]
  )

  /* ---------------- 渲染 ---------------- */

  return (
    <div className="ls-panel-inner">
      {/* 头部 */}
      <div className="ls-header">
        <div className="ls-brand">
          <LogoMark />
          <span>Linkscape</span>
        </div>
        <button className="ls-icon-btn" title="打开完整管理页" onClick={() => openExtensionPage('manager')}>
          <ExternalIcon />
        </button>
        <button
          className="ls-icon-btn"
          title="打开设置"
          aria-label="打开设置"
          onClick={() => openExtensionPage('options')}
        >
          <GearIcon />
        </button>
        <button className="ls-icon-btn" title="收起面板 (Esc)" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      {/* 搜索 */}
      <div className="ls-search">
        <div className="ls-search-box">
          <span className="ls-search-icon">
            <SearchIcon />
          </span>
          <input
            ref={searchRef}
            type="text"
            value={query}
            placeholder="搜索书签（支持拼音）…"
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="ls-search-clear"
            title="清空"
            onClick={() => setQuery('')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* 视图切换 */}
      {!showSearch && (
        <div className="ls-tabs">
          <button
            className={`ls-tab ${view === 'tree' ? 'ls-active' : ''}`}
            onClick={() => setView('tree')}
          >
            全部书签
          </button>
          <button
            className={`ls-tab ${view === 'favorites' ? 'ls-active' : ''}`}
            onClick={() => setView('favorites')}
          >
            收藏栏 {favorites.length > 0 ? `(${favorites.length})` : ''}
          </button>
        </div>
      )}

      {/* 内容 */}
      <div className="ls-list">
        {loading ? (
          <div className="ls-empty">
            <div className="ls-empty-icon">⏳</div>
            加载中…
          </div>
        ) : showSearch ? (
          <SearchView
            results={searchResults}
            byId={byId}
            favorites={favoritesSet}
            selection={emptySelection}
            selectMode={false}
            query={debouncedQuery}
            activeId={activeId}
            onOpen={handleOpen}
            onToggleFavorite={(n) => void actions.toggleFavorite(n.id)}
            onMore={(n, a) => setMenu({ node: n, x: a.x, y: a.y })}
            onCheck={() => undefined}
          />
        ) : view === 'favorites' ? (
          <FavoritesView
            tree={tree}
            favorites={favoritesSet}
            selection={emptySelection}
            selectMode={false}
            onOpen={handleOpen}
            onToggleFavorite={(n) => void actions.toggleFavorite(n.id)}
            onMore={(n, a) => setMenu({ node: n, x: a.x, y: a.y })}
            onCheck={() => undefined}
          />
        ) : (
          <TreeView
            nodes={topLevel}
            expanded={expanded}
            favorites={favoritesSet}
            selection={emptySelection}
            selectMode={false}
            query={undefined}
            onToggleFolder={(id) =>
              setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
            onOpen={handleOpen}
            onToggleFavorite={(n) => void actions.toggleFavorite(n.id)}
            onMore={(n, a) => setMenu({ node: n, x: a.x, y: a.y })}
            onCheck={() => undefined}
            draggingId={draggingId}
            dropTarget={dropTarget}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={(node, event) => void handleDrop(node, event)}
            onDragEnd={clearDrag}
          />
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="ls-error-banner" role="alert">
          {error}
        </div>
      )}

      {/* 撤销提示 */}
      {undoInfo && (
        <div className="ls-undo-bar" role="status">
          <span>已删除 {undoInfo.count} 项</span>
          <button className="ls-btn sm" onClick={() => void undo()}>
            撤销
          </button>
          <button className="ls-icon-btn" title="关闭" onClick={dismissUndo}>
            <CloseIcon />
          </button>
        </div>
      )}

      {/* 底部 */}
      <div className="ls-footer">
        <span>
          {counts.bookmarks} 个书签 · {counts.folders} 个文件夹
        </span>
        <span className="ls-footer-hint">批量操作请在完整管理页进行</span>
      </div>

      {/* 菜单 / 对话框 */}
      {menu && (
        <RowMenu
          anchor={menu}
          favorites={favoritesSet}
          onAction={handleAction}
          onClose={() => setMenu(null)}
        />
      )}
      {dialog && (
        <Dialogs
          dialog={dialog}
          tree={tree}
          onClose={() => setDialog(null)}
          onSubmit={handleDialogSubmit}
        />
      )}
    </div>
  )
}

/** 打开扩展页面（经由 SW，内容脚本无法直接调用 chrome.tabs.create）。 */
async function sendOpenPage(page: 'manager' | 'options'): Promise<void> {
  try {
    await sendMessageToBackground({ type: 'OPEN_EXTENSION_PAGE', page })
  } catch {
    /* 忽略 */
  }
}

/** Linkscape 完整书签管理页。 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookmarkNode } from '../shared/bookmark-types'
import {
  BOOKMARKS_BAR_ID,
  MOBILE_BOOKMARKS_ID,
  OTHER_BOOKMARKS_ID,
  displayTitle,
} from '../shared/bookmark-types'
import { usePanelData } from '../panel/panel-state'
import { useUndo } from '../panel/use-undo'
import { sendMessageToBackground } from '../shared/messages'
import { normalizeTodoPriority } from '../shared/todo-types'
import { SearchView } from '../panel/components/SearchView'
import { RowMenu } from '../panel/components/RowMenu'
import { Dialogs } from '../panel/components/Dialogs'
import {
  BookmarkIcon,
  CaretIcon,
  FolderIcon,
  LogoMark,
  MoreIcon,
  RefreshIcon,
  SearchIcon,
  StarIcon,
} from '../panel/components/Icons'
import { faviconSources, formatDate } from '../shared/ui-utils'
import { urlStatusLabel, type UrlStatusMap } from '../shared/url-status'
import type { DialogState, MenuAnchor, MenuPos, NodeAction } from '../panel/types'

const ROOT_TITLES: Record<string, string> = {
  [BOOKMARKS_BAR_ID]: '书签栏',
  [OTHER_BOOKMARKS_ID]: '其他书签',
  [MOBILE_BOOKMARKS_ID]: '移动书签',
}

export function ManagerPage(): JSX.Element {
  const data = usePanelData()
  const { tree, actions, paths, counts, error, loading, todoActions } = data

  const [currentFolderId, setCurrentFolderId] = useState<string>(BOOKMARKS_BAR_ID)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selection, setSelection] = useState<Set<string>>(() => new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [urlStatuses, setUrlStatuses] = useState<UrlStatusMap>({})
  const [invalidOnly, setInvalidOnly] = useState(false)
  const [testingUrls, setTestingUrls] = useState(false)
  const [urlTestError, setUrlTestError] = useState('')
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const { undoInfo, afterDelete, undo, dismissUndo } = useUndo()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 120)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    void sendMessageToBackground<{ statuses: UrlStatusMap }>({ type: 'GET_URL_STATUSES' })
      .then(({ statuses }) => setUrlStatuses(statuses))
      .catch(() => undefined)
  }, [tree])

  // 默认展开全部根
  useEffect(() => {
    setExpanded((prev) => {
      const roots = tree[0]?.children?.map((c) => c.id) ?? []
      const next = new Set(prev)
      for (const r of roots) next.add(r)
      return next
    })
  }, [tree])

  const byId = useMemo(() => {
    const m = new Map<string, BookmarkNode>()
    const walk = (nodes: BookmarkNode[]): void => {
      for (const n of nodes) {
        m.set(n.id, n)
        if (n.children) walk(n.children)
      }
    }
    walk(tree)
    return m
  }, [tree])

  const currentFolder = byId.get(currentFolderId)
  const children = currentFolder?.children ?? []
  const showSearch = debouncedQuery.trim().length > 0
  const searchResults = useMemo(
    () => (showSearch ? data.search(debouncedQuery) : []),
    [data, showSearch, debouncedQuery]
  )

  const allBookmarkIds = useMemo(
    () => [...byId.values()].filter((node) => node.url !== undefined).map((node) => node.id),
    [byId]
  )

  const invalidCount = useMemo(
    () => allBookmarkIds.filter((id) => urlStatuses[id]?.status === 'invalid').length,
    [allBookmarkIds, urlStatuses]
  )

  const visibleChildren = useMemo(
    () =>
      invalidOnly
        ? children.filter((node) => node.url !== undefined && urlStatuses[node.id]?.status === 'invalid')
        : children,
    [children, invalidOnly, urlStatuses]
  )

  const visibleSearchResults = useMemo(
    () =>
      invalidOnly
        ? searchResults.filter((hit) => urlStatuses[hit.id]?.status === 'invalid')
        : searchResults,
    [invalidOnly, searchResults, urlStatuses]
  )

  const selectableIds = useMemo(
    () =>
      showSearch
        ? visibleSearchResults.map((hit) => hit.id)
        : visibleChildren.map((node) => node.id),
    [showSearch, visibleChildren, visibleSearchResults]
  )

  useEffect(() => {
    setSelection((prev) => {
      const allowed = new Set(selectableIds)
      const next = new Set([...prev].filter((id) => allowed.has(id)))
      if (next.size === prev.size) return prev
      return next
    })
  }, [selectableIds])

  const breadcrumb = useMemo(() => {
    const segs: string[] = []
    let id: string | undefined = currentFolderId
    const guard = new Set<string>()
    while (id && !guard.has(id)) {
      guard.add(id)
      const node = byId.get(id)
      if (!node) break
      segs.unshift(node.title || ROOT_TITLES[node.id] || '（未命名）')
      id = node.parentId
    }
    return segs
  }, [currentFolderId, byId])

  /* ---------------- 操作 ---------------- */

  const handleOpen = useCallback(
    (node: BookmarkNode): void => {
      if (node.url) void actions.openInBackground(node.url)
    },
    [actions]
  )

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
        case 'add-todo':
          setDialog({ kind: 'add-todo', node })
          break
      }
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
          if (d.mode === 'move') setSelection(new Set())
          break
        }
        case 'confirm-delete':
          await actions.removeNodes(d.ids)
          setSelection(new Set())
          await afterDelete()
          break
        case 'add-todo':
          await todoActions.addTodo({
            title: d.node.title,
            url: d.node.url ?? '',
            priority: normalizeTodoPriority(values.priority),
          })
          break
      }
    },
    [actions, afterDelete, todoActions]
  )

  const toggleSelectAll = (): void => {
    if (!selectMode) setSelectMode(true)
    setSelection((prev) => {
      const allSelected = selectableIds.length > 0 && selectableIds.every((id) => prev.has(id))
      if (allSelected) return new Set()
      return new Set(selectableIds)
    })
  }

  const toggleSelectMode = (): void => {
    setSelectMode((prev) => {
      if (prev) setSelection(new Set())
      return !prev
    })
  }

  const favoritesSet = useMemo(
    () => new Set(data.favorites),
    [data.favorites]
  )

  const runUrlTest = useCallback(async (): Promise<void> => {
    const selectedBookmarkIds = [...selection].filter((id) => byId.get(id)?.url !== undefined)
    const ids = selection.size > 0 ? selectedBookmarkIds : allBookmarkIds
    if (ids.length === 0) {
      setUrlTestError(selection.size > 0 ? '当前选中项没有可检测的书签 URL' : '没有可检测的书签')
      return
    }
    setTestingUrls(true)
    setUrlTestError('')
    try {
      const { results } = await sendMessageToBackground<{ results: UrlStatusMap }>({
        type: 'TEST_BOOKMARK_URLS',
        ids,
      })
      setUrlStatuses((prev) => ({ ...prev, ...results }))
    } catch (error) {
      setUrlTestError(error instanceof Error ? error.message : String(error))
    } finally {
      setTestingUrls(false)
    }
  }, [allBookmarkIds, byId, selection])

  /* ---------------- 渲染 ---------------- */

  return (
    <div className="mgr-page">
      <div className="ls-topbar">
        <div className="ls-brand">
          <LogoMark />
          <span>Linkscape 书签管理</span>
        </div>

        <div className="mgr-search">
          <span className="mgr-search-icon">
            <SearchIcon />
          </span>
          <input
            ref={searchRef}
            type="text"
            value={query}
            placeholder="搜索全部书签（支持拼音）…"
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="mgr-search-clear" onClick={() => setQuery('')}>
            ✕
          </button>
        </div>

        <span className="spacer" />
        <button className="ls-btn" onClick={() => setDialog({ kind: 'new-bookmark', parentId: currentFolderId })}>
          <BookmarkIcon size={14} />
          新建书签
        </button>
        <button className="ls-btn" onClick={() => setDialog({ kind: 'new-folder', parentId: currentFolderId })}>
          <FolderIcon size={14} />
          新建文件夹
        </button>
        <button className="ls-btn" onClick={() => void data.refresh()} title="刷新">
          <RefreshIcon size={14} />
          刷新
        </button>
      </div>

      <div className="mgr-layout">
        {/* 左侧文件夹树 */}
        <aside className="mgr-tree-pane glass">
          <h2>文件夹</h2>
          <div className="mgr-tree">
            <FolderTree
              nodes={tree[0]?.children ?? []}
              depth={0}
              currentId={currentFolderId}
              expanded={expanded}
              onSelect={setCurrentFolderId}
              onToggle={(id) =>
                setExpanded((prev) => {
                  const next = new Set(prev)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              onMore={(node, anchor) => setMenu({ node, x: anchor.x, y: anchor.y })}
            />
          </div>
        </aside>

        {/* 右侧列表 */}
        <main className="mgr-main-pane glass">
          <div className="mgr-list-head">
            <span className="mgr-crumb">
              {breadcrumb.map((seg, i) => (
                <span key={i}>
                  {i > 0 && <span className="mgr-crumb-sep">/</span>}
                  {seg}
                </span>
              ))}
            </span>
            {!showSearch && (
              <span className="mgr-count">
                {visibleChildren.filter((c) => c.url !== undefined).length} 个书签 ·{' '}
                {visibleChildren.filter((c) => c.url === undefined).length} 个文件夹
              </span>
            )}
            <div className="mgr-actions">
              <button className="ls-btn sm" onClick={toggleSelectMode}>
                {selectMode ? '退出多选' : '多选'}
              </button>
              <button className="ls-btn sm" onClick={toggleSelectAll}>
                {selectableIds.length > 0 && selectableIds.every((id) => selection.has(id))
                  ? '取消全选'
                  : '全选'}
              </button>
              <button
                className={`ls-btn sm ${invalidOnly ? 'mgr-filter-active' : ''}`}
                onClick={() => setInvalidOnly((prev) => !prev)}
                title="只显示已检测为失效的书签"
              >
                无效{invalidCount > 0 ? ` (${invalidCount})` : ''}
              </button>
              <button
                className="ls-btn sm"
                onClick={() => void runUrlTest()}
                disabled={testingUrls}
                title={selection.size > 0 ? '检测选中的书签 URL' : '检测全部书签 URL'}
              >
                {testingUrls ? '检测中…' : selection.size > 0 ? '检测选中' : '检测 URL'}
              </button>
              <button className="ls-btn sm" onClick={() => void data.refresh()} title="刷新当前列表">
                <RefreshIcon size={13} />
              </button>
            </div>
          </div>

          <div className="mgr-list">
            {loading ? (
              <div className="ls-empty">
                <div className="ls-empty-icon">⏳</div>
                加载中…
              </div>
            ) : showSearch ? (
              <SearchView
                results={visibleSearchResults}
                byId={byId}
                favorites={favoritesSet}
                selection={selection}
                selectMode={selectMode}
                query={debouncedQuery}
                urlStatuses={urlStatuses}
                activeId={null}
                onOpen={handleOpen}
                onToggleFavorite={(n) => void actions.toggleFavorite(n.id)}
                onMore={(n, a) => setMenu({ node: n, x: a.x, y: a.y })}
                onCheck={(n, c) =>
                  setSelection((prev) => {
                    const next = new Set(prev)
                    if (c) next.add(n.id)
                    else next.delete(n.id)
                    return next
                  })
                }
              />
            ) : (
              <ManagerList
                nodes={visibleChildren}
                selection={selection}
                selectMode={selectMode}
                favorites={favoritesSet}
                paths={paths}
                urlStatuses={urlStatuses}
                onOpen={handleOpen}
                onSelectFolder={setCurrentFolderId}
                onToggleFavorite={(n) => void actions.toggleFavorite(n.id)}
                onMore={(n, a) => setMenu({ node: n, x: a.x, y: a.y })}
                onCheck={(n, c) =>
                  setSelection((prev) => {
                    const next = new Set(prev)
                    if (c) next.add(n.id)
                    else next.delete(n.id)
                    return next
                  })
                }
              />
            )}
          </div>

          {/* 批量工具栏 */}
          {selection.size > 0 && (
            <div className="mgr-bulkbar">
              <span className="ls-selbar-count">已选 {selection.size} 项</span>
              <button
                className="ls-btn sm"
                onClick={() => setDialog({ kind: 'move', ids: [...selection], mode: 'copy' })}
              >
                复制到…
              </button>
              <button
                className="ls-btn sm"
                onClick={() => setDialog({ kind: 'move', ids: [...selection], mode: 'move' })}
              >
                移动到…
              </button>
              <button
                className="ls-btn sm danger"
                onClick={() => setDialog({ kind: 'confirm-delete', ids: [...selection] })}
              >
                删除
              </button>
              <span style={{ flex: 1 }} />
              <button className="ls-btn sm" onClick={() => setSelection(new Set())}>
                取消选择
              </button>
            </div>
          )}

          {undoInfo && (
            <div className="ls-undo-bar" role="status" style={{ margin: '8px 16px 0' }}>
              <span>已删除 {undoInfo.count} 项</span>
              <button className="ls-btn sm" onClick={() => void undo()}>
                撤销
              </button>
              <button className="ls-btn sm" onClick={dismissUndo}>
                关闭
              </button>
            </div>
          )}

          <div className="mgr-status">
            <span>共 {counts.bookmarks} 个书签 · {counts.folders} 个文件夹</span>
            <span>双击书签在后台打开 · 支持拼音搜索</span>
            {urlTestError && <span className="mgr-url-error">⚠ {urlTestError}</span>}
            {error && <span style={{ color: 'var(--ls-danger)' }}>⚠ {error}</span>}
          </div>
        </main>
      </div>

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

/* ---------------- 子组件 ---------------- */

function FolderTree({
  nodes,
  depth,
  currentId,
  expanded,
  onSelect,
  onToggle,
  onMore,
}: {
  nodes: BookmarkNode[]
  depth: number
  currentId: string
  expanded: Set<string>
  onSelect: (id: string) => void
  onToggle: (id: string) => void
  onMore: (node: BookmarkNode, anchor: MenuPos) => void
}): JSX.Element {
  return (
    <>
      {nodes.map((node) => {
        if (node.url !== undefined) return null
        const isExpanded = expanded.has(node.id)
        const kids = node.children ?? []
        const handleMore = (e: React.MouseEvent): void => {
          e.stopPropagation()
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
          onMore(node, { x: rect.right - 200, y: rect.bottom + 4 })
        }
        return (
          <div key={node.id}>
            <div
              className={`mgr-tree-row ${currentId === node.id ? 'current' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => onSelect(node.id)}
            >
              <span
                className={`ls-caret ${isExpanded ? 'ls-open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(node.id)
                }}
              >
                <CaretIcon />
              </span>
              <span
                className="ls-folder-icon"
              >
                <FolderIcon size={12} />
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {node.title || ROOT_TITLES[node.id] || '（未命名）'}
              </span>
              <button className="ls-more" onClick={handleMore}>
                <MoreIcon />
              </button>
            </div>
            {isExpanded && (
              <div className="ls-children">
                <FolderTree
                  nodes={kids}
                  depth={depth + 1}
                  currentId={currentId}
                  expanded={expanded}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  onMore={onMore}
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

function ManagerList({
  nodes,
  selection,
  selectMode,
  favorites,
  paths,
  urlStatuses,
  onOpen,
  onSelectFolder,
  onToggleFavorite,
  onMore,
  onCheck,
}: {
  nodes: BookmarkNode[]
  selection: Set<string>
  selectMode: boolean
  favorites: Set<string>
  paths: Map<string, string>
  urlStatuses: UrlStatusMap
  onOpen: (node: BookmarkNode) => void
  onSelectFolder: (id: string) => void
  onToggleFavorite: (node: BookmarkNode) => void
  onMore: (node: BookmarkNode, anchor: MenuPos) => void
  onCheck: (node: BookmarkNode, checked: boolean) => void
}): JSX.Element {
  if (nodes.length === 0) {
    return (
      <div className="ls-empty">
        <div className="ls-empty-icon">🗂️</div>
        此文件夹是空的
        <div className="ls-hint">点击右上角「新建书签 / 新建文件夹」开始整理</div>
      </div>
    )
  }
  const folders = nodes.filter((n) => n.url === undefined)
  const bookmarks = nodes.filter((n) => n.url !== undefined)

  return (
    <>
      {[...folders, ...bookmarks].map((node) => (
        <div
          key={node.id}
          className={`mgr-row ${selection.has(node.id) ? 'selected' : ''}`}
          onClick={() => {
            if (selectMode) {
              onCheck(node, !selection.has(node.id))
              return
            }
            if (node.url === undefined) {
              onSelectFolder(node.id)
            } else {
              onOpen(node)
            }
          }}
          onDoubleClick={() => {
            if (!selectMode && node.url) void onOpen(node)
          }}
        >
          {selectMode && (
            <input
              type="checkbox"
              className="ls-checkbox"
              checked={selection.has(node.id)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onCheck(node, e.target.checked)}
            />
          )}
          {node.url === undefined ? (
            <span
              className="ls-folder-icon"
            >
              <FolderIcon size={13} />
            </span>
          ) : (
            <FaviconImg url={node.url} />
          )}
          <div className="mgr-main">
            <span className="mgr-title">{displayTitle(node)}</span>
            {node.url === undefined && (
              <span className="mgr-url">
                {(node.children ?? []).length} 项 · 路径：{paths.get(node.id) ?? ''}
              </span>
            )}
          </div>
          <div className="mgr-meta">
            {node.url && urlStatuses[node.id] && (
              <span
                className={`mgr-url-status ${urlStatuses[node.id].status}`}
                title={urlStatuses[node.id].reason ?? urlStatusLabel(urlStatuses[node.id].status)}
              >
                {urlStatusLabel(urlStatuses[node.id].status)}
              </span>
            )}
            <button
              className={`ls-star ${favorites.has(node.id) ? 'ls-on' : ''}`}
              style={{ display: 'inline-flex' }}
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite(node)
              }}
            >
              <StarIcon filled={favorites.has(node.id)} />
            </button>
            <span className="mgr-date">{formatDate(node.dateAdded)}</span>
            <button
              className="ls-more"
              onClick={(e) => {
                e.stopPropagation()
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                onMore(node, { x: rect.right - 190, y: rect.bottom + 4 })
              }}
            >
              <MoreIcon />
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

function FaviconImg({ url }: { url: string }): JSX.Element {
  const [sourceIndex, setSourceIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const sources = faviconSources(url, 32)

  useEffect(() => {
    setSourceIndex(0)
    setFailed(false)
  }, [url])

  if (failed || sources.length === 0) {
    return (
      <span className="ls-generic-icon">
        <BookmarkIcon size={13} />
      </span>
    )
  }

  return (
    <img
      src={sources[sourceIndex]}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      style={{
        width: 20,
        height: 20,
        borderRadius: 5,
        flex: 'none',
        objectFit: 'contain',
      }}
      onError={() => {
        if (sourceIndex + 1 < sources.length) setSourceIndex((i) => i + 1)
        else setFailed(true)
      }}
    />
  )
}

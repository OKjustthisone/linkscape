/** 递归书签树视图。 */

import type { BookmarkNode } from '../../shared/bookmark-types'
import {
  BOOKMARKS_BAR_ID,
  isSpecialRootId,
  MOBILE_BOOKMARKS_ID,
  OTHER_BOOKMARKS_ID,
} from '../../shared/bookmark-types'
import { BookmarkRow, type DropTarget } from './BookmarkRow'
import type { MenuPos } from '../types'

export interface TreeViewProps {
  nodes: BookmarkNode[]
  expanded: Set<string>
  favorites: Set<string>
  selection: Set<string>
  selectMode: boolean
  query?: string
  onToggleFolder: (id: string) => void
  onOpen: (node: BookmarkNode) => void
  onToggleFavorite: (node: BookmarkNode) => void
  onMore: (node: BookmarkNode, anchor: MenuPos) => void
  onCheck: (node: BookmarkNode, checked: boolean) => void
  draggingId?: string | null
  dropTarget?: DropTarget | null
  onDragStart?: (node: BookmarkNode, event: React.DragEvent<HTMLElement>) => void
  onDragOver?: (node: BookmarkNode, event: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (node: BookmarkNode, event: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: () => void
}

/** 特殊根文件夹的展示名回退（Chrome 按语言返回标题）。 */
const ROOT_TITLES: Record<string, string> = {
  [BOOKMARKS_BAR_ID]: '书签栏',
  [OTHER_BOOKMARKS_ID]: '其他书签',
  [MOBILE_BOOKMARKS_ID]: '移动书签',
}

export function TreeView(props: TreeViewProps): JSX.Element {
  const {
    nodes,
    expanded,
    favorites,
    selection,
    selectMode,
    query,
    onToggleFolder,
    onOpen,
    onToggleFavorite,
    onMore,
    onCheck,
    draggingId,
    dropTarget,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = props

  return (
    <>
      {nodes.map((node) => {
        const isFolder = node.url === undefined
        const id = node.id
        const isExpanded = expanded.has(id)
        const children = isFolder && node.children ? node.children : []

        return (
          <div key={id} className="ls-node">
            <BookmarkRow
              node={{
                ...node,
                title: node.title || ROOT_TITLES[id] || '（未命名）',
              }}
              isFolder={isFolder}
              isFavorite={favorites.has(id)}
              isExpanded={isExpanded}
              isSelected={selection.has(id)}
              isChecked={selection.has(id)}
              showCheckbox={selectMode}
              query={query}
              onOpen={onOpen}
              onToggleFolder={() => onToggleFolder(id)}
              onToggleFavorite={onToggleFavorite}
              onMore={onMore}
              onCheck={onCheck}
              draggable={!isSpecialRootId(node.id)}
              isDragging={draggingId === id}
              dropPosition={dropTarget?.id === id ? dropTarget.position : undefined}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
            />
            {isFolder && isExpanded && children.length > 0 && (
              <div className="ls-tree-children">
                <TreeView
                nodes={children}
                  expanded={expanded}
                  favorites={favorites}
                  selection={selection}
                  selectMode={selectMode}
                  query={query}
                  onToggleFolder={onToggleFolder}
                  onOpen={onOpen}
                  onToggleFavorite={onToggleFavorite}
                  onMore={onMore}
                  onCheck={onCheck}
                  draggingId={draggingId}
                  dropTarget={dropTarget}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

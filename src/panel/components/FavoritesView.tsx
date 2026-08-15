/** 收藏栏视图：扁平列表，显示所有被收藏的书签。 */

import type { BookmarkNode } from '../../shared/bookmark-types'
import { BookmarkRow } from './BookmarkRow'
import type { MenuPos } from '../types'

export interface FavoritesViewProps {
  tree: BookmarkNode[]
  favorites: Set<string>
  selection: Set<string>
  selectMode: boolean
  onOpen: (node: BookmarkNode) => void
  onToggleFavorite: (node: BookmarkNode) => void
  onMore: (node: BookmarkNode, anchor: MenuPos) => void
  onCheck: (node: BookmarkNode, checked: boolean) => void
}

export function FavoritesView(props: FavoritesViewProps): JSX.Element {
  const { tree, favorites, selection, selectMode, onOpen, onToggleFavorite, onMore, onCheck } = props

  // 收集所有被收藏的节点（书签与文件夹）
  const nodes: BookmarkNode[] = []
  const walk = (list: BookmarkNode[]): void => {
    for (const n of list) {
      if (favorites.has(n.id)) nodes.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(tree)

  if (nodes.length === 0) {
    return (
      <div className="ls-empty">
        <div className="ls-empty-icon">☆</div>
        收藏栏是空的
        <div className="ls-hint">把鼠标移到任意书签上，点击星标即可收藏</div>
      </div>
    )
  }

  return (
    <>
      {nodes.map((node) => (
        <BookmarkRow
          key={node.id}
          node={node}
          isFolder={node.url === undefined}
          isFavorite
          isSelected={selection.has(node.id)}
          isChecked={selection.has(node.id)}
          showCheckbox={selectMode}
          onOpen={onOpen}
          onToggleFolder={() => undefined}
          onToggleFavorite={onToggleFavorite}
          onMore={onMore}
          onCheck={onCheck}
        />
      ))}
    </>
  )
}

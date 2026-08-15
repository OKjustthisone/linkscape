/** 搜索结果视图。 */

import type { BookmarkNode } from '../../shared/bookmark-types'
import { BookmarkRow } from './BookmarkRow'
import type { MenuPos } from '../types'
import type { UrlStatusMap } from '../../shared/url-status'

export interface SearchHit {
  id: string
  title: string
  url?: string
  path: string
  score: number
}

export interface SearchViewProps {
  results: SearchHit[]
  byId: Map<string, BookmarkNode>
  favorites: Set<string>
  selection: Set<string>
  selectMode: boolean
  query: string
  activeId: string | null
  onOpen: (node: BookmarkNode) => void
  onToggleFavorite: (node: BookmarkNode) => void
  onMore: (node: BookmarkNode, anchor: MenuPos) => void
  onCheck: (node: BookmarkNode, checked: boolean) => void
  urlStatuses?: UrlStatusMap
}

export function SearchView(props: SearchViewProps): JSX.Element {
  const {
    results,
    byId,
    favorites,
    selection,
    selectMode,
    query,
    activeId,
    onOpen,
    onToggleFavorite,
    onMore,
    onCheck,
    urlStatuses,
  } = props

  if (results.length === 0) {
    return (
      <div className="ls-empty">
        <div className="ls-empty-icon">🔍</div>
        没有找到与「{query}」匹配的书签
        <div className="ls-hint">支持标题、网址、域名、文件夹路径、拼音全拼与首字母</div>
      </div>
    )
  }

  return (
    <>
      {results.map((hit) => {
        const node = byId.get(hit.id)
        if (!node) return null
        return (
          <div key={hit.id}>
            <BookmarkRow
              node={node}
              isFolder={false}
              isFavorite={favorites.has(hit.id)}
              isSelected={selection.has(hit.id)}
              isChecked={selection.has(hit.id)}
              isActive={activeId === hit.id}
              showCheckbox={selectMode}
              query={query}
              onOpen={onOpen}
              onToggleFolder={() => undefined}
              onToggleFavorite={onToggleFavorite}
              onMore={onMore}
              onCheck={onCheck}
              urlStatus={urlStatuses?.[hit.id]}
            />
          </div>
        )
      })}
    </>
  )
}

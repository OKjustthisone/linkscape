/** 书签 / 文件夹行。 */

import { useEffect, useState } from 'react'
import type { BookmarkNode } from '../../shared/bookmark-types'
import { displayTitle } from '../../shared/bookmark-types'
import { faviconSources } from '../../shared/ui-utils'
import { urlStatusLabel, type UrlCheckResult } from '../../shared/url-status'
import { highlightText } from './Highlight'
import { BookmarkIcon, CaretIcon, FolderIcon, MoreIcon, StarIcon } from './Icons'
import type { MenuPos } from '../types'

// 记录当前页面中已经确认没有可用网站图标的书签 URL。
// 面板收起/展开时不再重复触发 favicon 请求和失败回退动画。
const unavailableFaviconUrls = new Set<string>()

export type DropPosition = 'before' | 'after' | 'inside'
export interface DropTarget {
  id: string
  position: DropPosition
}

interface FaviconProps {
  url?: string
  draggable?: boolean
  onDragStart?: (event: React.DragEvent<HTMLElement>) => void
  onDragEnd?: () => void
}

export function Favicon({ url, draggable = false, onDragStart, onDragEnd }: FaviconProps): JSX.Element {
  const cacheKey = url?.trim() ?? ''
  const [failed, setFailed] = useState(() => !cacheKey || unavailableFaviconUrls.has(cacheKey))
  const [sourceIndex, setSourceIndex] = useState(0)
  const sources = url ? faviconSources(url, 32) : []

  const handleDragStart = (event: React.DragEvent<HTMLElement>): void => {
    onDragStart?.(event)
  }

  useEffect(() => {
    setFailed(!cacheKey || unavailableFaviconUrls.has(cacheKey))
    setSourceIndex(0)
  }, [cacheKey])

  if (failed || sources.length === 0) {
    return (
      <span
        className={`ls-generic-icon ${draggable ? 'ls-draggable-icon' : ''}`}
        draggable={draggable}
        onDragStart={draggable ? handleDragStart : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
      >
        <BookmarkIcon size={11} />
      </span>
    )
  }
  return (
    <img
      className={`ls-favicon ${draggable ? 'ls-draggable-icon' : ''}`}
      src={sources[sourceIndex]}
      alt=""
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      // 面板本身会滑出视口，lazy 图片可能在每次展开时重新开始加载。
      // 提前完成请求后，收起/展开只显示已经确定的图标或默认图标。
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (sourceIndex + 1 < sources.length) setSourceIndex((i) => i + 1)
        else {
          unavailableFaviconUrls.add(cacheKey)
          setFailed(true)
        }
      }}
    />
  )
}

export interface RowProps {  node: BookmarkNode
  isFolder: boolean
  isFavorite: boolean
  isExpanded?: boolean
  isSelected: boolean
  isActive?: boolean
  isChecked: boolean
  showCheckbox: boolean
  query?: string
  onOpen: (node: BookmarkNode) => void
  onToggleFolder: (node: BookmarkNode) => void
  onToggleFavorite: (node: BookmarkNode) => void
  onMore: (node: BookmarkNode, anchor: MenuPos) => void
  onCheck: (node: BookmarkNode, checked: boolean) => void
  urlStatus?: UrlCheckResult
  draggable?: boolean
  isDragging?: boolean
  dropPosition?: DropPosition
  onDragStart?: (node: BookmarkNode, event: React.DragEvent<HTMLElement>) => void
  onDragOver?: (node: BookmarkNode, event: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (node: BookmarkNode, event: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: () => void
}

export function BookmarkRow(props: RowProps): JSX.Element {
  const {
    node,
    isFolder,
    isFavorite,
    isExpanded,
    isSelected,
    isActive,
    isChecked,
    showCheckbox,
    query,
    onOpen,
    onToggleFolder,
    onToggleFavorite,
    onMore,
    onCheck,
    urlStatus,
    draggable = false,
    isDragging = false,
    dropPosition,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = props

  const title = displayTitle(node)

  const handleIconDragStart = (event: React.DragEvent<HTMLElement>): void => {
    onDragStart?.(node, event)
  }

  const handleIconDragEnd = (): void => {
    onDragEnd?.()
  }

  const handleMore = (e: React.MouseEvent): void => {
    e.stopPropagation()
    const panel = (e.currentTarget as HTMLElement).closest('.ls-panel')
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const panelRect = panel?.getBoundingClientRect() ?? { left: 0, top: 0 }
    onMore(node, {
      x: rect.right - panelRect.left - 180,
      y: rect.bottom - panelRect.top + 4,
    })
  }

  const handleClick = (): void => {
    if (showCheckbox) {
      onCheck(node, !isChecked)
      return
    }
    if (isFolder) {
      onToggleFolder(node)
      return
    }
    onOpen(node)
  }

  const cls = [
    'ls-row',
    isFolder ? 'ls-folder' : 'ls-bookmark',
    isSelected ? 'ls-selected' : '',
    isActive ? 'ls-active-row' : '',
    isChecked ? 'ls-checked' : '',
    isDragging ? 'ls-dragging' : '',
    dropPosition ? `ls-drop-${dropPosition}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cls}
      style={{ paddingLeft: 8 }}
      role={isFolder ? 'treeitem' : 'button'}
      aria-expanded={isFolder ? !!isExpanded : undefined}
      onClick={handleClick}
      draggable={false}
      onDragOver={(e) => onDragOver?.(node, e)}
      onDrop={(e) => onDrop?.(node, e)}
    >
      {isFolder ? (
        <span className={`ls-caret ${isExpanded ? 'ls-open' : ''}`}>
          <CaretIcon />
        </span>
      ) : (
        <span className="ls-caret ls-spacer">
          <CaretIcon />
        </span>
      )}

      {showCheckbox && (
        <input
          type="checkbox"
          className="ls-checkbox"
          checked={isChecked}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onCheck(node, e.target.checked)}
        />
      )}

      {isFolder ? (
        <span
          className={`ls-folder-icon ${draggable ? 'ls-draggable-icon' : ''}`}
          draggable={draggable}
          onDragStart={draggable ? handleIconDragStart : undefined}
          onDragEnd={draggable ? handleIconDragEnd : undefined}
        >
          <FolderIcon size={11} />
        </span>
      ) : (
        <Favicon
          url={node.url}
          draggable={draggable}
          onDragStart={handleIconDragStart}
          onDragEnd={handleIconDragEnd}
        />
      )}

      <span className="ls-row-main">
        <span className="ls-row-title">
          {highlightText(title, query)}
          {urlStatus && urlStatus.status !== 'valid' && (
            <span
              className={`ls-url-status ${urlStatus.status}`}
              title={urlStatus.reason ?? urlStatusLabel(urlStatus.status)}
            >
              {urlStatusLabel(urlStatus.status)}
            </span>
          )}
        </span>
      </span>

      <button
        className={`ls-star ${isFavorite ? 'ls-on' : ''}`}
        title={isFavorite ? '取消收藏' : '收藏'}
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite(node)
        }}
        draggable={false}
      >
        <StarIcon filled={isFavorite} />
      </button>

      <button
        className="ls-more"
        title="更多操作"
        onClick={handleMore}
        draggable={false}
      >
        <MoreIcon />
      </button>
    </div>
  )
}

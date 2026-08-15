/** 右键/更多操作菜单。 */

import type { BookmarkNode } from '../../shared/bookmark-types'
import { isFolder } from '../../shared/bookmark-types'
import type { MenuAnchor, NodeAction } from '../types'

export interface RowMenuProps {
  anchor: MenuAnchor
  favorites: Set<string>
  onAction: (action: NodeAction, node: BookmarkNode) => void
  onClose: () => void
}

export function RowMenu({ anchor, favorites, onAction, onClose }: RowMenuProps): JSX.Element {
  const { node } = anchor
  const folder = isFolder(node)

  const items: { action: NodeAction; label: string; danger?: boolean }[] = []
  if (!folder) {
    items.push({ action: 'open', label: '在后台打开' })
  }
  items.push({
    action: 'toggle-favorite',
    label: favorites.has(node.id) ? '取消收藏' : '添加到收藏栏',
  })
  if (folder) {
    items.push({ action: 'new-bookmark', label: '在此新建书签' })
    items.push({ action: 'new-folder', label: '在此新建文件夹' })
  }
  items.push({ action: 'rename', label: '重命名' })
  items.push({ action: 'move', label: '移动到…' })
  items.push({ action: 'copy', label: '复制到…' })
  items.push({ action: 'delete', label: '删除', danger: true })

  return (
    <>
      <div className="ls-overlay ls-menu-overlay" onClick={onClose} />
      <div
        className="ls-menu"
        style={{ left: anchor.x, top: anchor.y }}
        role="menu"
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.action}
            role="menuitem"
            className={`ls-menu-item ${item.danger ? 'ls-danger' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onClose()
              onAction(item.action, node)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}

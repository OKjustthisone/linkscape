/** 面板通用类型。 */

import type { BookmarkNode } from '../shared/bookmark-types'

export type NodeAction =
  | 'open'
  | 'toggle-favorite'
  | 'rename'
  | 'move'
  | 'copy'
  | 'delete'
  | 'new-bookmark'
  | 'new-folder'

/** 弹层定位（相对面板/页面容器）。 */
export interface MenuPos {
  x: number
  y: number
}

export interface MenuAnchor extends MenuPos {
  node: BookmarkNode
}

export type DialogState =
  | { kind: 'rename'; node: BookmarkNode }
  | { kind: 'new-bookmark'; parentId: string; parentTitle?: string }
  | { kind: 'new-folder'; parentId: string; parentTitle?: string }
  | { kind: 'move'; ids: string[]; mode: 'move' | 'copy' }
  | { kind: 'confirm-delete'; ids: string[] }

export const isFolderNode = (node: BookmarkNode): boolean =>
  node.url === undefined

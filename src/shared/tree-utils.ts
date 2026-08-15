/**
 * 书签树纯函数工具：路径计算、节点查找、防循环移动校验、子树克隆。
 * 这些逻辑与 Chrome API 无关，可单测。
 */

import type { BookmarkNode, BookmarkTree } from './bookmark-types'
import { isFolder, isSpecialRootId } from './bookmark-types'

/** 深度优先遍历所有节点（含根）。 */
export function* walkTree(nodes: BookmarkNode[]): Generator<BookmarkNode> {
  for (const node of nodes) {
    yield node
    if (node.children) yield* walkTree(node.children)
  }
}

/** 以 id 建索引。 */
export function indexById(nodes: BookmarkNode[]): Map<string, BookmarkNode> {
  const map = new Map<string, BookmarkNode>()
  for (const node of walkTree(nodes)) map.set(node.id, node)
  return map
}

export function findNode(nodes: BookmarkNode[], id: string): BookmarkNode | undefined {
  for (const node of walkTree(nodes)) {
    if (node.id === id) return node
  }
  return undefined
}

/** 计算每个节点的「文件夹路径」（如 书签栏/工具/前端）。
 *  文件夹节点的路径包含自身标题；书签节点的路径即其所在文件夹路径。 */
export function computePaths(nodes: BookmarkNode[]): Map<string, string> {
  const paths = new Map<string, string>()
  const visit = (node: BookmarkNode, prefix: string) => {
    if (node.url === undefined) {
      const path = prefix ? `${prefix}/${node.title || '（未命名）'}` : node.title || ''
      paths.set(node.id, path)
      if (node.children) {
        for (const child of node.children) visit(child, path)
      }
    } else {
      paths.set(node.id, prefix)
    }
  }
  // 忽略顶层根节点（id 为空串的虚拟根），直接从三个特殊根开始。
  for (const root of nodes) {
    if (root.id === '') {
      for (const child of root.children ?? []) visit(child, '')
    } else {
      visit(root, '')
    }
  }
  return paths
}

/** 收集节点自身及其全部后代 id。 */
export function collectIdsWithDescendants(node: BookmarkNode): Set<string> {
  const ids = new Set<string>()
  for (const n of walkTree([node])) ids.add(n.id)
  return ids
}

export interface MoveCheck {
  ok: boolean
  reason?: string
}

/**
 * 校验批量移动：目标必须是文件夹，且不能把节点移动到自身或其后代，
 * 也不能移动 Chrome 特殊根节点。
 */
export function checkMove(
  tree: BookmarkTree,
  targetIds: string[],
  destParentId: string
): MoveCheck {
  if (targetIds.length === 0) return { ok: false, reason: '未选择任何节点' }
  for (const id of targetIds) {
    if (isSpecialRootId(id)) {
      return { ok: false, reason: '不能移动 Chrome 特殊根文件夹' }
    }
  }
  const byId = indexById(tree)
  const dest = byId.get(destParentId)
  if (!dest) return { ok: false, reason: '目标文件夹不存在' }
  if (!isFolder(dest)) return { ok: false, reason: '目标不是文件夹' }

  const blocked = new Set<string>()
  for (const id of targetIds) {
    const node = byId.get(id)
    if (!node) return { ok: false, reason: `节点 ${id} 不存在` }
    for (const nid of collectIdsWithDescendants(node)) blocked.add(nid)
  }
  if (blocked.has(destParentId)) {
    return { ok: false, reason: '不能移动到自身或其子文件夹' }
  }
  return { ok: true }
}

/** 深拷贝一棵子树（用于「复制文件夹」的递归结构遍历）。 */
export function cloneSubtree(node: BookmarkNode): BookmarkNode {
  return {
    ...node,
    children: node.children ? node.children.map((c) => cloneSubtree(c)) : undefined,
  }
}

/** 统计节点数量（书签 / 文件夹），忽略 id 为空串的虚拟根。 */
export function countNodes(nodes: BookmarkNode[]): {
  bookmarks: number
  folders: number
} {
  let bookmarks = 0
  let folders = 0
  for (const node of walkTree(nodes)) {
    if (node.id === '') continue
    if (isFolder(node)) folders += 1
    else bookmarks += 1
  }
  return { bookmarks, folders }
}

/**
 * 书签树相关类型。
 * Chrome 的 BookmarkTreeNode 不可序列化（含函数原型），
 * 跨上下文传递时统一使用这里的扁平可序列化结构。
 */

/** 序列化后的书签树节点（与 chrome.bookmarks.BookmarkTreeNode 对应）。 */
export interface BookmarkNode {
  id: string
  parentId?: string
  index?: number
  url?: string
  title: string
  dateAdded?: number
  dateGroupModified?: number
  children?: BookmarkNode[]
}

export type BookmarkTreeNode = BookmarkNode

/** 一棵书签树（chrome.bookmarks.getTree() 返回的根节点数组）。 */
export type BookmarkTree = BookmarkNode[]

/** Chrome 特殊根节点 id。 */
export const ROOT_ID = ''
export const BOOKMARKS_BAR_ID = '0'
export const OTHER_BOOKMARKS_ID = '1'
export const MOBILE_BOOKMARKS_ID = '2'

/** 是否是 Chrome 特殊根节点（不允许删除/重命名/移动）。 */
export function isSpecialRootId(id: string): boolean {
  return (
    id === ROOT_ID ||
    id === BOOKMARKS_BAR_ID ||
    id === OTHER_BOOKMARKS_ID ||
    id === MOBILE_BOOKMARKS_ID
  )
}

/** 节点是否为文件夹。 */
export function isFolder(node: BookmarkNode | undefined): boolean {
  return !!node && node.url === undefined
}

/** 给一个节点用于显示的标题（空标题回退到 URL）。 */
export function displayTitle(node: Pick<BookmarkNode, 'title' | 'url'>): string {
  return node.title || node.url || '（无标题）'
}

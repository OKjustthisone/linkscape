/** 树工具测试：路径计算、复制结构、防循环移动、特殊根保护。 */

import { describe, expect, it } from 'vitest'
import type { BookmarkTree } from '../bookmark-types'
import {
  checkMove,
  cloneSubtree,
  collectIdsWithDescendants,
  computePaths,
  countNodes,
  findNode,
  indexById,
} from '../tree-utils'

const TREE: BookmarkTree = [
  {
    id: '',
    title: '',
    children: [
      {
        id: '0',
        title: '书签栏',
        children: [
          { id: 'a', title: '前端', children: [
            { id: 'a1', title: 'React 文档', url: 'https://react.dev' },
            { id: 'a2', title: 'Vue', url: 'https://vuejs.org' },
          ]},
          { id: 'b', title: 'GitHub', url: 'https://github.com' },
        ],
      },
      {
        id: '1',
        title: '其他书签',
        children: [{ id: 'c', title: '工具', children: [] }],
      },
    ],
  },
]

describe('computePaths', () => {
  it('计算文件夹路径', () => {
    const paths = computePaths(TREE)
    expect(paths.get('0')).toBe('书签栏')
    expect(paths.get('a1')).toBe('书签栏/前端')
    expect(paths.get('a2')).toBe('书签栏/前端')
    expect(paths.get('c')).toBe('其他书签/工具')
  })
})

describe('indexById / findNode', () => {
  it('索引包含所有节点', () => {
    const map = indexById(TREE)
    expect(map.size).toBe(8) // 虚拟根 + 7 个真实节点
    expect(map.get('a2')?.url).toBe('https://vuejs.org')
  })

  it('findNode 递归查找', () => {
    expect(findNode(TREE, 'c')?.title).toBe('工具')
    expect(findNode(TREE, 'nope')).toBeUndefined()
  })
})

describe('collectIdsWithDescendants', () => {
  it('收集自身与后代', () => {
    const node = findNode(TREE, '0')!
    const ids = collectIdsWithDescendants(node)
    expect([...ids].sort()).toEqual(['0', 'a', 'a1', 'a2', 'b'])
  })
})

describe('cloneSubtree', () => {
  it('深拷贝不共享引用', () => {
    const node = findNode(TREE, '0')!
    const copy = cloneSubtree(node)
    expect(copy).toEqual(node)
    expect(copy.children).not.toBe(node.children)
    expect(copy.children![0]).not.toBe(node.children![0])
    // 更深一层的 children 也独立
    expect(copy.children![0].children![0]).not.toBe(node.children![0].children![0])
  })
})

describe('checkMove', () => {
  it('允许移动到普通文件夹', () => {
    expect(checkMove(TREE, ['b'], 'a').ok).toBe(true)
  })

  it('禁止移动到自身', () => {
    expect(checkMove(TREE, ['a'], 'a').ok).toBe(false)
  })

  it('禁止移动到后代文件夹', () => {
    expect(checkMove(TREE, ['a'], 'a1').ok).toBe(false)
    expect(checkMove(TREE, ['a'], 'a2').ok).toBe(false)
  })

  it('禁止移动特殊根节点', () => {
    expect(checkMove(TREE, ['0'], '1').ok).toBe(false)
  })

  it('目标不是文件夹时拒绝', () => {
    expect(checkMove(TREE, ['a'], 'b').ok).toBe(false)
  })

  it('目标不存在时拒绝', () => {
    expect(checkMove(TREE, ['a'], 'ghost').ok).toBe(false)
  })

  it('空选择拒绝', () => {
    expect(checkMove(TREE, [], 'a').ok).toBe(false)
  })

  it('多选批量移动：整体校验', () => {
    expect(checkMove(TREE, ['a', 'b'], '1').ok).toBe(true)
  })
})

describe('countNodes', () => {
  it('统计书签与文件夹数量', () => {
    const { bookmarks, folders } = countNodes(TREE)
    expect(bookmarks).toBe(3)
    expect(folders).toBe(4) // 0, a, 1, c
  })
})

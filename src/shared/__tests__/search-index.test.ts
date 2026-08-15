/** 拼音搜索索引测试。 */

import { describe, expect, it } from 'vitest'
import { SearchIndex, pinyinFull, pinyinInitials } from '../search-index'
import type { SearchableBookmark } from '../search-index'

function build(items: SearchableBookmark[]): SearchIndex {
  const idx = new SearchIndex()
  idx.build(items)
  return idx
}

const FIXTURE: SearchableBookmark[] = [
  { id: 'a', title: '开发文档', url: 'https://dev.example.com/docs', path: '书签栏/前端' },
  { id: 'b', title: 'Vue 开发指南', url: 'https://vuejs.org/guide', path: '书签栏/前端' },
  { id: 'c', title: 'GitHub', url: 'https://github.com', path: '其他书签/工具' },
  { id: 'd', title: '哔哩哔哩', url: 'https://www.bilibili.com', path: '其他书签/视频' },
  { id: 'e', title: 'React 文档', url: 'https://react.dev', path: '书签栏/前端' },
]

describe('pinyin 工具', () => {
  it('中文标题生成拼音全拼', () => {
    expect(pinyinFull('开发文档')).toBe('kaifawendang')
  })

  it('中文标题生成拼音首字母', () => {
    expect(pinyinInitials('开发文档')).toBe('kfwd')
  })

  it('中英混合标题', () => {
    expect(pinyinFull('Vue 开发指南')).toContain('kai')
    expect(pinyinInitials('Vue 开发指南')).toContain('kf')
  })
})

describe('SearchIndex.search', () => {
  const idx = build(FIXTURE)

  it('按标题关键字搜索', () => {
    const r = idx.search('开发')
    expect(r.map((x) => x.id)).toContain('a')
    expect(r.map((x) => x.id)).toContain('b')
  })

  it('按中文拼音全拼搜索', () => {
    const r = idx.search('kaifawendang')
    expect(r.map((x) => x.id)).toEqual(['a'])
  })

  it('按中文拼音首字母搜索', () => {
    const r = idx.search('kfwd')
    expect(r.map((x) => x.id)).toEqual(['a'])
  })

  it('按拼音片段搜索', () => {
    const r = idx.search('bili')
    expect(r.map((x) => x.id)).toEqual(['d'])
  })

  it('按 URL / 域名搜索', () => {
    const r = idx.search('github.com')
    expect(r.map((x) => x.id)).toContain('c')
  })

  it('按文件夹路径搜索', () => {
    const r = idx.search('书签栏')
    expect(r.map((x) => x.id).sort()).toEqual(['a', 'b', 'e'])
  })

  it('多词元 AND 匹配', () => {
    const r = idx.search('vue kai')
    expect(r.map((x) => x.id)).toEqual(['b'])
    expect(idx.search('vue github').length).toBe(0)
  })

  it('大小写不敏感', () => {
    expect(idx.search('GITHUB').length).toBe(1)
  })

  it('全角半角归一化', () => {
    expect(idx.search('ｇｉｔｈｕｂ').length).toBe(1)
  })

  it('无匹配返回空', () => {
    expect(idx.search('不存在的书签xyz')).toEqual([])
  })

  it('空查询返回空', () => {
    expect(idx.search('  ')).toEqual([])
  })

  it('标题前缀命中优先于包含', () => {
    // "react" 前缀命中 React 文档，得分高于包含的
    const r = idx.search('react')
    expect(r[0].id).toBe('e')
  })
})

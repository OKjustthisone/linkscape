/**
 * 书签搜索索引。
 *
 * 每个书签节点建立可搜索字段：
 *  - 原始标题、网址、域名、文件夹路径
 *  - 小写化 + 全角半角归一化后的文本
 *  - 中文标题的拼音全拼（开发文档 -> kaifawendang）
 *  - 中文标题的拼音首字母（开发文档 -> kfwd）
 *
 * 查询按空白分词，全部词元都必须命中（AND），按字段优先级打分排序。
 */

import { pinyin } from 'pinyin-pro'
import { parseUrl } from './url-matcher'

export interface SearchableBookmark {
  id: string
  title: string
  url?: string
  /** 文件夹路径，如 书签栏/工具/前端。 */
  path: string
}

export interface SearchResult {
  id: string
  title: string
  url?: string
  path: string
  score: number
}

interface SearchDoc {
  id: string
  title: string
  url: string
  domain: string
  path: string
  /** 归一化字段（NFKC + 小写）。 */
  normTitle: string
  normUrl: string
  normDomain: string
  normPath: string
  /** 拼音全拼。 */
  py: string
  /** 拼音首字母。 */
  pyInit: string
}

/** 归一化：全角/半角统一 + 小写化 + 去首尾空白。 */
export function normalizeText(s: string): string {
  return s.normalize('NFKC').toLowerCase().trim()
}

/** 提取域名（去 www.）。 */
export function domainOf(url: string | undefined): string {
  if (!url) return ''
  const parsed = parseUrl(url)
  return parsed ? parsed.host : ''
}

/** 中文标题 -> 拼音全拼（无音调、无空格）。 */
export function pinyinFull(text: string): string {
  if (!text) return ''
  return pinyin(text, { toneType: 'none', type: 'array' })
    .map((s) => s.toLowerCase())
    .join('')
}

/** 中文标题 -> 拼音首字母。 */
export function pinyinInitials(text: string): string {
  if (!text) return ''
  return pinyin(text, { pattern: 'first', toneType: 'none', type: 'array' })
    .map((s) => s.toLowerCase())
    .join('')
}

export class SearchIndex {
  private docs: SearchDoc[] = []
  private readonly byId = new Map<string, SearchDoc>()

  /** 重建索引（小规模数据直接全量重建）。 */
  build(items: SearchableBookmark[]): void {
    this.docs = []
    this.byId.clear()
    for (const item of items) {
      const doc: SearchDoc = {
        id: item.id,
        title: item.title,
        url: item.url ?? '',
        domain: domainOf(item.url),
        path: item.path,
        normTitle: normalizeText(item.title),
        normUrl: normalizeText(item.url ?? ''),
        normDomain: normalizeText(domainOf(item.url)),
        normPath: normalizeText(item.path),
        py: pinyinFull(item.title),
        pyInit: pinyinInitials(item.title),
      }
      this.docs.push(doc)
      this.byId.set(item.id, doc)
    }
  }

  size(): number {
    return this.docs.length
  }

  /** 单个词元对单个文档的匹配得分；不命中返回 0。 */
  private matchToken(doc: SearchDoc, token: string): number {
    const t = normalizeText(token)
    if (!t) return 0
    // 标题：前缀命中优先级最高
    if (doc.normTitle.startsWith(t)) return 100
    if (doc.py.startsWith(t)) return 90
    if (doc.pyInit.startsWith(t)) return 80
    if (doc.normTitle.includes(t)) return 60
    if (doc.py.includes(t)) return 55
    if (doc.pyInit.includes(t)) return 45
    if (doc.normDomain.startsWith(t)) return 42
    if (doc.normDomain.includes(t)) return 30
    if (doc.normUrl.includes(t)) return 25
    if (doc.normPath.includes(t)) return 20
    return 0
  }

  /** 执行搜索。所有词元必须命中；返回按得分降序的结果。 */
  search(query: string, limit = 200): SearchResult[] {
    const tokens = query.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return []
    const out: SearchResult[] = []
    for (const doc of this.docs) {
      let score = 0
      let hit = true
      for (const token of tokens) {
        const s = this.matchToken(doc, token)
        if (s === 0) {
          hit = false
          break
        }
        score += s
      }
      if (hit) {
        out.push({
          id: doc.id,
          title: doc.title,
          url: doc.url || undefined,
          path: doc.path,
          score,
        })
      }
    }
    out.sort((a, b) => b.score - a.score || a.title.length - b.title.length)
    return out.slice(0, limit)
  }
}

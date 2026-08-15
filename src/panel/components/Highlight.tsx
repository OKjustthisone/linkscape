/** 搜索高亮：把 query 命中的片段用 <mark> 包裹。 */

import type { ReactNode } from 'react'
import { escapeRegExp } from '../../shared/ui-utils'

export function highlightText(
  text: string,
  query: string | undefined
): ReactNode {
  const q = (query ?? '').trim()
  if (!q) return text
  let pattern: RegExp
  try {
    pattern = new RegExp(`(${escapeRegExp(q)})`, 'gi')
  } catch {
    return text
  }
  // split 会保留捕获组（即命中的片段），用大小写不敏感比较即可识别命中项
  const parts = text.split(pattern)
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className="ls-mark">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

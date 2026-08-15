/** 书签 URL 可用性检测结果。 */

export type UrlCheckStatus = 'valid' | 'invalid' | 'unknown'

export interface UrlCheckResult {
  id: string
  url: string
  status: UrlCheckStatus
  statusCode?: number
  reason?: string
  checkedAt: number
}

export type UrlStatusMap = Record<string, UrlCheckResult>

export function urlStatusLabel(status: UrlCheckStatus): string {
  if (status === 'valid') return '可用'
  if (status === 'invalid') return '失效'
  return '待确认'
}

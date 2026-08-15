/**
 * URL / 域名 / 通配符匹配工具。
 * 用于「排除页面」规则与「按域名搜索」。
 */

import type { ExclusionRule } from './settings'

export interface ParsedUrl {
  href: string
  protocol: string
  hostname: string
  /** 去除 www. 前缀的主机名（小写）。 */
  host: string
  pathname: string
}

export function parseUrl(url: string): ParsedUrl | null {
  try {
    const u = new URL(url)
    return {
      href: u.href,
      protocol: u.protocol.toLowerCase(),
      hostname: u.hostname.toLowerCase(),
      host: u.hostname.toLowerCase().replace(/^www\./, ''),
      pathname: u.pathname,
    }
  } catch {
    return null
  }
}

/**
 * 通配符匹配：* 匹配任意字符（包括空）。
 * 特殊约定：模式中的 `*.` 视作「任意子域名或裸域名」，
 * 例如 *://*.example.com/* 同时命中 https://example.com/ 与 https://a.example.com/x。
 */
export function wildcardMatch(haystack: string, pattern: string): boolean {
  const parts = pattern.split('*.')
  const regex = parts
    .map((part, i) => {
      const escaped = part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      return i > 0 ? `(.*\\.)?${escaped}` : escaped
    })
    .join('')
  try {
    return new RegExp(`^${regex}$`, 'i').test(haystack)
  } catch {
    return false
  }
}

/**
 * 判断一条域名规则是否命中：精确相等或子域名。
 * 规则里的前导 *.（如 *.example.com）按「域名或子域名」处理。
 */
export function matchDomainRule(host: string, ruleValue: string): boolean {
  const h = host.trim().toLowerCase()
  let value = ruleValue.trim().toLowerCase().replace(/^www\./, '')
  if (value.startsWith('*.')) value = value.slice(2)
  if (!value) return false
  return h === value || h.endsWith(`.${value}`)
}

/** 判断一条 URL 规则是否命中：网址前缀（忽略协议大小写）。 */
export function matchUrlRule(href: string, ruleValue: string): boolean {
  const value = ruleValue.trim().toLowerCase()
  if (!value) return false
  return href.toLowerCase().startsWith(value)
}

/**
 * 判断一条通配符规则是否命中：
 * - 规则含协议或路径（如 *://*.example.com/path/*）-> 对完整 href 匹配；
 * - 否则视为域名模式（如 *.example.com）-> 对 host 匹配（含子域名语义）。
 */
export function matchGlobRule(url: string, ruleValue: string): boolean {
  const value = ruleValue.trim()
  if (!value) return false
  const parsed = parseUrl(url)
  if (!parsed) return false
  if (/[:\/]/.test(value) || value.includes('*://')) {
    return wildcardMatch(parsed.href, value)
  }
  return matchDomainRule(parsed.host, value)
}

/** 依据规则列表判断一个 URL 是否被排除（任一启用规则命中即排除）。 */
export function matchUrlAgainstRules(url: string, rules: ExclusionRule[]): boolean {
  const parsed = parseUrl(url)
  if (!parsed) return false
  for (const rule of rules) {
    if (!rule.enabled) continue
    const value = rule.value.trim()
    if (!value) continue
    let hit = false
    switch (rule.type) {
      case 'domain':
        hit = matchDomainRule(parsed.host, value)
        break
      case 'url':
        hit = matchUrlRule(parsed.href, value)
        break
      case 'match':
        hit = matchGlobRule(parsed.href, value)
        break
    }
    if (hit) return true
  }
  return false
}

/** 该 URL 是否为 Chrome 受保护页面（内容脚本无法注入）。 */
export function isProtectedUrl(url: string | undefined): boolean {
  if (!url) return false
  if (url.startsWith('chrome://')) return true
  if (url.startsWith('edge://')) return true
  if (url.startsWith('chrome-extension://')) return true
  if (url.startsWith('devtools://')) return true
  if (url.startsWith('view-source:')) return true
  if (url.startsWith('about:')) return true
  if (url.startsWith('chrome.google.com/webstore')) return true
  try {
    const u = new URL(url)
    return (
      u.hostname === 'chrome.google.com' && u.pathname.startsWith('/webstore')
    )
  } catch {
    return false
  }
}

/** 从网址提取「域名」规则建议值。 */
export function suggestDomainRule(url: string): string {
  const parsed = parseUrl(url)
  return parsed ? parsed.host : ''
}

/** 从网址提取「网址」规则建议值（协议+主机+路径前缀）。 */
export function suggestUrlRule(url: string): string {
  const parsed = parseUrl(url)
  if (!parsed) return ''
  const path = parsed.pathname.split('/').slice(0, 3).join('/')
  return `${parsed.protocol}//${parsed.hostname}${path}`
}

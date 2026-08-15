/** URL / 域名 / 通配符匹配测试。 */

import { describe, expect, it } from 'vitest'
import {
  isProtectedUrl,
  matchDomainRule,
  matchGlobRule,
  matchUrlAgainstRules,
  matchUrlRule,
  suggestDomainRule,
  suggestUrlRule,
  wildcardMatch,
} from '../url-matcher'
import { createExclusionRule } from '../settings'

describe('wildcardMatch', () => {
  it('* 匹配任意内容', () => {
    expect(wildcardMatch('https://a.example.com/x', '*://*.example.com/*')).toBe(true)
    expect(wildcardMatch('https://a.example.com', '*://*.example.com/*')).toBe(false)
  })

  it('普通规则为精确匹配', () => {
    expect(wildcardMatch('example.com', 'example.com')).toBe(true)
    expect(wildcardMatch('sub.example.com', 'example.com')).toBe(false)
  })
})

describe('matchDomainRule', () => {
  it('精确域名命中', () => {
    expect(matchDomainRule('example.com', 'example.com')).toBe(true)
  })

  it('子域名命中', () => {
    expect(matchDomainRule('sub.example.com', 'example.com')).toBe(true)
    expect(matchDomainRule('a.b.example.com', 'example.com')).toBe(true)
  })

  it('其他域名不命中', () => {
    expect(matchDomainRule('notexample.com', 'example.com')).toBe(false)
    expect(matchDomainRule('example.org', 'example.com')).toBe(false)
  })

  it('www. 前缀与 *. 前缀归一', () => {
    expect(matchDomainRule('www.example.com', 'example.com')).toBe(true)
    expect(matchDomainRule('sub.example.com', '*.example.com')).toBe(true)
    expect(matchDomainRule('example.com', '*.example.com')).toBe(true)
  })

  it('大小写不敏感', () => {
    expect(matchDomainRule('EXAMPLE.COM', 'example.com')).toBe(true)
  })
})

describe('matchUrlRule', () => {
  it('网址前缀命中', () => {
    expect(matchUrlRule('https://example.com/docs/a', 'https://example.com/docs')).toBe(true)
  })

  it('不同前缀不命中', () => {
    expect(matchUrlRule('https://example.com/other', 'https://example.com/docs')).toBe(false)
  })
})

describe('matchGlobRule', () => {
  it('带协议的规则对 href 匹配', () => {
    expect(matchGlobRule('https://a.example.com/path', '*://*.example.com/*')).toBe(true)
    expect(matchGlobRule('http://example.com/', '*://*.example.com/*')).toBe(true)
    expect(matchGlobRule('https://other.org/x', '*://*.example.com/*')).toBe(false)
  })

  it('纯域名通配按域名语义', () => {
    expect(matchGlobRule('https://sub.example.com/x', '*.example.com')).toBe(true)
    expect(matchGlobRule('https://example.com/x', '*.example.com')).toBe(true)
    expect(matchGlobRule('https://other.com/x', '*.example.com')).toBe(false)
  })
})

describe('matchUrlAgainstRules', () => {
  it('任一启用规则命中即排除', () => {
    const rules = [
      createExclusionRule('domain', 'example.com'),
      createExclusionRule('url', 'https://blocked.org/private'),
    ]
    expect(matchUrlAgainstRules('https://sub.example.com/x', rules)).toBe(true)
    expect(matchUrlAgainstRules('https://blocked.org/private/notes', rules)).toBe(true)
    expect(matchUrlAgainstRules('https://free.org/', rules)).toBe(false)
  })

  it('停用的规则不生效', () => {
    const rule = createExclusionRule('domain', 'example.com')
    rule.enabled = false
    expect(matchUrlAgainstRules('https://example.com', [rule])).toBe(false)
  })

  it('空值规则忽略', () => {
    const rule = createExclusionRule('domain', '   ')
    expect(matchUrlAgainstRules('https://example.com', [rule])).toBe(false)
  })

  it('非法 URL 不排除', () => {
    expect(matchUrlAgainstRules('not a url', [createExclusionRule('domain', 'x')])).toBe(false)
  })
})

describe('isProtectedUrl', () => {
  it('识别受保护页面', () => {
    expect(isProtectedUrl('chrome://extensions')).toBe(true)
    expect(isProtectedUrl('chrome://settings')).toBe(true)
    expect(isProtectedUrl('edge://newtab')).toBe(true)
    expect(isProtectedUrl('about:blank')).toBe(true)
    expect(isProtectedUrl('view-source:https://a.com')).toBe(true)
    expect(isProtectedUrl('chrome.google.com/webstore')).toBe(true)
    expect(isProtectedUrl('https://chrome.google.com/webstore/category/extensions')).toBe(true)
  })

  it('普通页面不受保护', () => {
    expect(isProtectedUrl('https://example.com')).toBe(false)
    expect(isProtectedUrl('http://localhost:3000/')).toBe(false)
  })
})

describe('规则建议', () => {
  it('域名建议去 www', () => {
    expect(suggestDomainRule('https://www.example.com/docs')).toBe('example.com')
  })

  it('网址建议保留协议与路径前缀', () => {
    expect(suggestUrlRule('https://example.com/docs/guide/page')).toBe(
      'https://example.com/docs/guide'
    )
  })
})

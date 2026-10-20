/** 与 UI 相关的轻量工具（不依赖 React，SW 也可安全引用）。 */

/** 站点 favicon 地址（MV3 chrome://favicon 替代方案，需 "favicon" 权限）。 */
export function faviconUrl(url: string | undefined, size = 32): string {
  if (!url) return ''
  try {
    return chrome.runtime.getURL(
      `_favicon/?pageUrl=${encodeURIComponent(url)}&size=${size}`
    )
  } catch {
    return ''
  }
}

/** 站点自己的 favicon 作为 Chrome favicon 服务不可用时的第二候选。 */
export function websiteFaviconUrl(url: string | undefined): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return `${parsed.origin}/favicon.ico`
  } catch {
    return ''
  }
}

/** 返回真实网站图标候选，优先使用 Chrome 的 favicon 服务。 */
export function faviconSources(url: string | undefined, size = 32): string[] {
  const sources = [faviconUrl(url, size)]
  const direct = websiteFaviconUrl(url)
  if (direct && !sources.includes(direct)) sources.push(direct)
  return sources.filter(Boolean)
}

/** Linkscape 图形标识地址，兼容根目录加载器与 dist 内部加载。 */
export function logoUrl(): string {
  try {
    const manifest = chrome.runtime.getManifest()
    const iconPath =
      (manifest.action?.default_icon as Record<string, string> | undefined)?.['128'] ??
      'icons/icon128.png'
    const slash = iconPath.lastIndexOf('/')
    const directory = slash >= 0 ? iconPath.slice(0, slash + 1) : ''
    return chrome.runtime.getURL(`${directory}linkscape-mark.png`)
  } catch {
    return ''
  }
}

/** 时间戳 -> 显示用日期。 */
export function formatDate(ts: number | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 网址 -> 主机名（用于副标题展示）。 */
export function urlHost(url: string | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** 转义正则特殊字符。 */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

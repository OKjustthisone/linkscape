/** 扩展页面路径解析，兼容根目录加载与历史 dist 目录加载。 */

export type ExtensionPage = 'manager' | 'options'

/**
 * 根据当前生效的 manifest 推导扩展页面目录。
 *
 * 当前根目录清单和历史 dist 清单都使用 `options.html`；这里保留
 * 根据清单解析目录的逻辑，避免页面入口落到源码 HTML。
 */
export function getExtensionPageUrl(page: ExtensionPage): string {
  const optionsPage = chrome.runtime.getManifest().options_page ?? 'options.html'
  const slashIndex = optionsPage.lastIndexOf('/')
  const directory = slashIndex >= 0 ? optionsPage.slice(0, slashIndex + 1) : ''
  return chrome.runtime.getURL(`${directory}${page}.html`)
}

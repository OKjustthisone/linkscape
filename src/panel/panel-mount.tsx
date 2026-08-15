/**
 * 把 React 面板挂载进 Shadow DOM。
 * 由 edge-host 调用；负责向面板传递宿主能力（关闭、开关状态通知）。
 */

import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { BookmarkPanel } from './BookmarkPanel'
import type { Settings } from '../shared/settings'

export interface PanelHostApi {
  open: () => void
  close: () => void
  onPanelEnter: () => void
  onPanelLeave: () => void
  getSettings: () => Settings
}

export interface MountedPanel {
  root: Root
  setOpen: (open: boolean) => void
}

export function mountPanel(
  panelEl: HTMLElement,
  host: PanelHostApi
): MountedPanel {
  const container = document.createElement('div')
  container.id = 'ls-panel-root'
  panelEl.appendChild(container)

  // 面板区域的进入/离开：保持展开
  panelEl.addEventListener('mouseenter', host.onPanelEnter)
  panelEl.addEventListener('mouseleave', host.onPanelLeave)

  const root = createRoot(container)
  root.render(<BookmarkPanel open={false} onClose={host.close} />)

  return {
    root,
    setOpen: (open: boolean) => {
      // 同一组件类型更新：React 保留面板内部状态（搜索词、展开的文件夹等）
      root.render(<BookmarkPanel open={open} onClose={host.close} />)
    },
  }
}

/** 删除后「撤销」提示：删除成功后展示短暂恢复入口。 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RemovedSnapshot } from '../shared/messages'
import { sendMessageToBackground } from '../shared/messages'

export interface UndoInfo {
  count: number
  timestamp: number
}

export function useUndo(): {
  undoInfo: UndoInfo | null
  afterDelete: () => Promise<void>
  undo: () => Promise<void>
  dismissUndo: () => void
} {
  const [undoInfo, setUndoInfo] = useState<UndoInfo | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const dismissUndo = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setUndoInfo(null)
  }, [])

  const afterDelete = useCallback(async (): Promise<void> => {
    try {
      const { snapshot } = await sendMessageToBackground<{
        snapshot: RemovedSnapshot | null
      }>({ type: 'GET_LAST_REMOVED' })
      if (snapshot && snapshot.nodes.length > 0) {
        setUndoInfo({ count: snapshot.nodes.length, timestamp: snapshot.timestamp })
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setUndoInfo(null), 8000)
      }
    } catch {
      /* 忽略 */
    }
  }, [])

  const undo = useCallback(async (): Promise<void> => {
    dismissUndo()
    try {
      await sendMessageToBackground({ type: 'UNDO_LAST_REMOVED' })
    } catch {
      /* 撤销失败时忽略（书签事件广播会刷新界面） */
    }
  }, [dismissUndo])

  return { undoInfo, afterDelete, undo, dismissUndo }
}

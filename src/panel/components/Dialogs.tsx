/** 面板内对话框：重命名 / 新建书签 / 新建文件夹 / 移动复制 / 删除确认。 */

import { useMemo, useState } from 'react'
import type { BookmarkNode, BookmarkTree } from '../../shared/bookmark-types'
import { isFolder, isSpecialRootId } from '../../shared/bookmark-types'
import { collectIdsWithDescendants } from '../../shared/tree-utils'
import { FolderIcon } from './Icons'
import type { DialogState } from '../types'

export interface DialogsProps {
  dialog: DialogState
  tree: BookmarkTree
  onClose: () => void
  onSubmit: (dialog: DialogState, values: Record<string, string>) => Promise<void>
}

function TextField({
  label,
  value,
  onChange,
  autoFocus,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  placeholder?: string
}): JSX.Element {
  return (
    <div className="ls-field">
      <label>{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function Dialogs({ dialog, tree, onClose, onSubmit }: DialogsProps): JSX.Element | null {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [destId, setDestId] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // 派生：移动/复制时被禁用的目标（自身 + 后代）
  const blocked = useMemo(() => {
    const set = new Set<string>()
    if (dialog.kind === 'move') {
      for (const id of dialog.ids) {
        const node = findNodeById(tree, id)
        if (node) for (const nid of collectIdsWithDescendants(node)) set.add(nid)
      }
    }
    return set
  }, [dialog, tree])

  // 切换 dialog 时重置表单（setState-in-render 的派生状态写法）
  const key = useMemo(
    () =>
      dialog.kind +
      (dialog.kind === 'move'
        ? dialog.ids.join(',')
        : dialog.kind === 'rename'
          ? dialog.node.id
          : ''),
    [dialog]
  )
  const [resetKey, setResetKey] = useState('')
  if (resetKey !== key) {
    setResetKey(key)
    setTitle('')
    setUrl('')
    setError('')
    setBusy(false)
    setDestId('')
  }

  const submit = async (values: Record<string, string>): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await onSubmit(dialog, values)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const prevent = (e: React.FormEvent): void => {
    e.preventDefault()
    e.stopPropagation()
  }

  if (dialog.kind === 'rename') {
    return (
      <div className="ls-overlay">
        <form className="ls-modal" onSubmit={(e) => { prevent(e); void submit({ title }) }}>
          <h3>重命名</h3>
          <TextField label="名称" value={title} onChange={setTitle} autoFocus placeholder={dialog.node.title} />
          <ErrorLine error={error} />
          <Actions busy={busy} onCancel={onClose} okLabel="保存" />
        </form>
      </div>
    )
  }

  if (dialog.kind === 'new-bookmark') {
    return (
      <div className="ls-overlay">
        <form className="ls-modal" onSubmit={(e) => { prevent(e); void submit({ title, url }) }}>
          <h3>新建书签</h3>
          <TextField label="标题" value={title} onChange={setTitle} placeholder="书签名称" />
          <TextField label="网址" value={url} onChange={setUrl} autoFocus placeholder="https://example.com" />
          <ErrorLine error={error} />
          <Actions busy={busy} onCancel={onClose} okLabel="创建" />
        </form>
      </div>
    )
  }

  if (dialog.kind === 'new-folder') {
    return (
      <div className="ls-overlay">
        <form className="ls-modal" onSubmit={(e) => { prevent(e); void submit({ title }) }}>
          <h3>新建文件夹</h3>
          <TextField label="文件夹名称" value={title} onChange={setTitle} autoFocus placeholder="例如：工具" />
          <ErrorLine error={error} />
          <Actions busy={busy} onCancel={onClose} okLabel="创建" />
        </form>
      </div>
    )
  }

  if (dialog.kind === 'move') {
    const canSelect = (id: string): boolean => {
      if (blocked.has(id)) return false
      const node = findNodeById(tree, id)
      return !!node && isFolder(node)
    }
    return (
      <div className="ls-overlay">
        <form
          className="ls-modal"
          onSubmit={(e) => {
            prevent(e)
            if (!destId) {
              setError('请选择目标文件夹')
              return
            }
            void submit({ destId })
          }}
        >
          <h3>{dialog.mode === 'move' ? '移动到…' : '复制到…'}</h3>
          <div className="ls-field">
            <label>目标文件夹（{dialog.ids.length} 个节点）</label>
            <div className="ls-picktree">
              <FolderPicker
                nodes={topLevelFolders(tree)}
                depth={0}
                destId={destId}
                blocked={blocked}
                expanded={expanded}
                canSelect={canSelect}
                onPick={setDestId}
                onToggle={(id) =>
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
              />
            </div>
          </div>
          <ErrorLine error={error} />
          <Actions busy={busy} onCancel={onClose} okLabel={dialog.mode === 'move' ? '移动' : '复制'} />
        </form>
      </div>
    )
  }

  if (dialog.kind === 'confirm-delete') {
    const n = dialog.ids.length
    return (
      <div className="ls-overlay">
        <form
          className="ls-modal"
          onSubmit={(e) => {
            prevent(e)
            void submit({})
          }}
        >
          <h3>确认删除</h3>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--ls-text-dim)' }}>
            将删除 {n} 个节点{n > 1 ? '（含其中文件夹的所有内容）' : ''}，此操作不可撤销。
          </p>
          <ErrorLine error={error} />
          <Actions busy={busy} onCancel={onClose} okLabel="删除" danger />
        </form>
      </div>
    )
  }

  return null
}

/* ---------- 内部小组件 ---------- */

function ErrorLine({ error }: { error: string }): JSX.Element {
  return <div className="ls-error">{error}</div>
}

function Actions({
  busy,
  onCancel,
  okLabel,
  danger,
}: {
  busy: boolean
  onCancel: () => void
  okLabel: string
  danger?: boolean
}): JSX.Element {
  return (
    <div className="ls-modal-actions">
      <button type="button" className="ls-btn" onClick={onCancel} disabled={busy}>
        取消
      </button>
      <button type="submit" className={`ls-btn ${danger ? 'ls-danger' : 'ls-primary'}`} disabled={busy}>
        {busy ? '处理中…' : okLabel}
      </button>
    </div>
  )
}

function findNodeById(nodes: BookmarkTree, id: string): BookmarkNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const found = findNodeById(n.children, id)
      if (found) return found
    }
  }
  return undefined
}

/** 顶层可选文件夹：三个特殊根。 */
function topLevelFolders(tree: BookmarkTree): BookmarkNode[] {
  return tree[0]?.children ?? []
}

function FolderPicker({
  nodes,
  depth,
  destId,
  blocked,
  expanded,
  canSelect,
  onPick,
  onToggle,
}: {
  nodes: BookmarkNode[]
  depth: number
  destId: string
  blocked: Set<string>
  expanded: Set<string>
  canSelect: (id: string) => boolean
  onPick: (id: string) => void
  onToggle: (id: string) => void
}): JSX.Element {
  return (
    <>
      {nodes.map((node) => {
        if (!isFolder(node)) return null
        const selectable = canSelect(node.id)
        const isExpanded = expanded.has(node.id)
        const children = (node.children ?? []).filter((c) => isFolder(c))
        return (
          <div key={node.id}>
            <div
              className={`ls-row ${selectable ? '' : 'ls-disabled'} ${destId === node.id ? 'ls-selected' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => {
                if (!selectable) return
                onPick(node.id)
                if (!isExpanded && children.length > 0) onToggle(node.id)
              }}
            >
              <span
                className={`ls-caret ${isExpanded ? 'ls-open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggle(node.id)
                }}
              >
                {children.length > 0 ? '▶' : ''}
              </span>
              <span className="ls-folder-icon">
                <FolderIcon size={12} />
              </span>
              <span className="ls-row-main">
                <span className="ls-row-title">
                  {node.title || (isSpecialRootId(node.id) ? '（特殊根）' : '（未命名）')}
                </span>
              </span>
              {destId === node.id && <span className="ls-folder-badge">目标</span>}
            </div>
            {isExpanded && children.length > 0 && (
              <div className="ls-children">
                <FolderPicker
                  nodes={children}
                  depth={depth + 1}
                  destId={destId}
                  blocked={blocked}
                  expanded={expanded}
                  canSelect={canSelect}
                  onPick={onPick}
                  onToggle={onToggle}
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

/** To do 视图：按优先级（高 / 中 / 低）分组显示待办事项。 */

import { useMemo, useState } from 'react'
import type { TodoItem, TodoPriority } from '../../shared/todo-types'
import {
  groupTodosByPriority,
  TODO_PRIORITY_COLOR,
  TODO_PRIORITY_FULL_LABEL,
  TODO_PRIORITY_LABEL,
} from '../../shared/todo-types'
import { urlHost } from '../../shared/ui-utils'
import { Favicon } from './BookmarkRow'

export interface TodoViewProps {
  todos: TodoItem[]
  onOpen: (todo: TodoItem) => void
  onToggleDone: (todo: TodoItem) => void
  onSetPriority: (todo: TodoItem, priority: TodoPriority) => void
  onRemove: (todo: TodoItem) => void
}

/** 点击优先级标签时的循环顺序：高 -> 中 -> 低 -> 高。 */
const NEXT_PRIORITY: Record<TodoPriority, TodoPriority> = {
  high: 'medium',
  medium: 'low',
  low: 'high',
}

export function TodoView(props: TodoViewProps): JSX.Element {
  const { todos, onOpen, onToggleDone, onSetPriority, onRemove } = props
  const [showDone, setShowDone] = useState(true)

  const groups = useMemo(() => groupTodosByPriority(todos), [todos])
  const pendingCount = useMemo(() => todos.filter((t) => !t.done).length, [todos])

  if (todos.length === 0) {
    return (
      <div className="ls-empty">
        <div className="ls-empty-icon">✓</div>
        还没有待办事项
        <div className="ls-hint">点击工具栏图标 →「添加到 To do」记录当前页面</div>
      </div>
    )
  }

  return (
    <div className="ls-todo">
      <div className="ls-todo-toolbar">
        <span className="ls-todo-summary">待办 {pendingCount} 项</span>
        <button
          className="ls-btn sm"
          onClick={() => setShowDone((v) => !v)}
          title={showDone ? '隐藏已完成事项' : '显示已完成事项'}
        >
          {showDone ? '隐藏已完成' : '显示已完成'}
        </button>
      </div>

      {groups.map((group) => {
        const visible = showDone
          ? group.items
          : group.items.filter((todo) => !todo.done)
        if (visible.length === 0) return null
        return (
          <section key={group.priority} className="ls-todo-group">
            <header className="ls-todo-group-head">
              <span
                className="ls-todo-dot"
                style={{ background: TODO_PRIORITY_COLOR[group.priority] }}
              />
              <span className="ls-todo-group-title">
                {TODO_PRIORITY_FULL_LABEL[group.priority]}
              </span>
              <span className="ls-todo-count">{visible.length}</span>
            </header>
            {visible.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                onOpen={onOpen}
                onToggleDone={onToggleDone}
                onSetPriority={onSetPriority}
                onRemove={onRemove}
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}

interface TodoRowProps {
  todo: TodoItem
  onOpen: (todo: TodoItem) => void
  onToggleDone: (todo: TodoItem) => void
  onSetPriority: (todo: TodoItem, priority: TodoPriority) => void
  onRemove: (todo: TodoItem) => void
}

function TodoRow(props: TodoRowProps): JSX.Element {
  const { todo, onOpen, onToggleDone, onSetPriority, onRemove } = props
  const color = TODO_PRIORITY_COLOR[todo.priority]
  const host = urlHost(todo.url)

  return (
    <div
      className={`ls-todo-row ${todo.done ? 'ls-done' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(todo)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(todo)
        }
      }}
    >
      <button
        className={`ls-todo-check ${todo.done ? 'ls-on' : ''}`}
        title={todo.done ? '标记为未完成' : '标记为已完成'}
        onClick={(e) => {
          e.stopPropagation()
          onToggleDone(todo)
        }}
      >
        {todo.done ? '✓' : ''}
      </button>

      <Favicon url={todo.url} />

      <span className="ls-row-main">
        <span className="ls-row-title">{todo.title}</span>
        <span className="ls-row-sub">{host}</span>
      </span>

      <button
        className="ls-todo-priority"
        style={{ color }}
        title={`优先级：${TODO_PRIORITY_FULL_LABEL[todo.priority]}（点击切换）`}
        onClick={(e) => {
          e.stopPropagation()
          onSetPriority(todo, NEXT_PRIORITY[todo.priority])
        }}
      >
        <span className="ls-todo-dot" style={{ background: color }} />
        {TODO_PRIORITY_LABEL[todo.priority]}
      </button>

      <button
        className="ls-todo-remove"
        title="删除"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(todo)
        }}
      >
        ✕
      </button>
    </div>
  )
}

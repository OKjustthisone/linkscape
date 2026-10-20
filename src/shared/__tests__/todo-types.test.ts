/** To do 待办数据与优先级测试。 */

import { describe, expect, it } from 'vitest'
import {
  groupTodosByPriority,
  isTodoPriority,
  normalizeTodoPriority,
  sanitizeTodoItems,
  TODO_PRIORITY_COLOR,
  TODO_PRIORITY_ORDER,
  type TodoItem,
} from '../todo-types'

function makeTodo(partial: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 'todo-1',
    title: '示例',
    url: 'https://example.com',
    priority: 'medium',
    done: false,
    createdAt: 1,
    ...partial,
  }
}

describe('优先级', () => {
  it('只接受高/中/低', () => {
    expect(isTodoPriority('high')).toBe(true)
    expect(isTodoPriority('medium')).toBe(true)
    expect(isTodoPriority('low')).toBe(true)
    expect(isTodoPriority('urgent')).toBe(false)
    expect(isTodoPriority(undefined)).toBe(false)
  })

  it('非法值回退到中优先级', () => {
    expect(normalizeTodoPriority('high')).toBe('high')
    expect(normalizeTodoPriority('nope')).toBe('medium')
    expect(normalizeTodoPriority('nope', 'low')).toBe('low')
  })

  it('高中低分别使用红黄绿', () => {
    expect(TODO_PRIORITY_ORDER).toEqual(['high', 'medium', 'low'])
    expect(TODO_PRIORITY_COLOR.high).toMatch(/^#(e|f)/) // 红
    expect(TODO_PRIORITY_COLOR.medium).toMatch(/^#(e|d)/) // 黄
    expect(TODO_PRIORITY_COLOR.low).toMatch(/^#(2|1)/) // 绿
  })
})

describe('sanitizeTodoItems', () => {
  it('非数组返回空列表', () => {
    expect(sanitizeTodoItems(undefined)).toEqual([])
    expect(sanitizeTodoItems({})).toEqual([])
  })

  it('丢弃缺少网址的条目', () => {
    const items = sanitizeTodoItems([
      { id: 'a', title: 'A', url: 'https://a.com', priority: 'high' },
      { id: 'b', title: 'B' },
      null,
      'x',
    ])
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('a')
  })

  it('补全缺失字段', () => {
    const [item] = sanitizeTodoItems([{ url: 'https://a.com' }])
    expect(item.title).toBe('https://a.com')
    expect(item.priority).toBe('medium')
    expect(item.done).toBe(false)
    expect(item.id).toBeTruthy()
  })
})

describe('groupTodosByPriority', () => {
  it('按高 -> 中 -> 低分组', () => {
    const groups = groupTodosByPriority([
      makeTodo({ id: 'l', priority: 'low' }),
      makeTodo({ id: 'h', priority: 'high' }),
      makeTodo({ id: 'm', priority: 'medium' }),
    ])
    expect(groups.map((g) => g.priority)).toEqual(['high', 'medium', 'low'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['h'])
    expect(groups[1].items.map((i) => i.id)).toEqual(['m'])
    expect(groups[2].items.map((i) => i.id)).toEqual(['l'])
  })

  it('组内保持原有顺序', () => {
    const groups = groupTodosByPriority([
      makeTodo({ id: '1', priority: 'high' }),
      makeTodo({ id: '2', priority: 'high' }),
    ])
    expect(groups[0].items.map((i) => i.id)).toEqual(['1', '2'])
  })
})

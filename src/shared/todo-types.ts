/**
 * To do（待办）数据类型与优先级定义。
 *
 * 待办数据保存在 chrome.storage.local 的 "todos" 键下，
 * 与书签数据相互独立，删除书签不会影响待办。
 */

/** 待办优先级：高 / 中 / 低。 */
export type TodoPriority = 'high' | 'medium' | 'low'

/** 一条待办。 */
export interface TodoItem {
  id: string
  title: string
  url: string
  priority: TodoPriority
  /** 是否已完成。 */
  done: boolean
  createdAt: number
}

/** 待办可修改的字段。 */
export interface TodoPatch {
  title?: string
  url?: string
  priority?: TodoPriority
  done?: boolean
}

/** 存储键。 */
export const TODO_STORAGE_KEY = 'todos'

/** 优先级排序（从高到低）。 */
export const TODO_PRIORITY_ORDER: readonly TodoPriority[] = ['high', 'medium', 'low']

/** 优先级短标签。 */
export const TODO_PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

/** 优先级完整标签。 */
export const TODO_PRIORITY_FULL_LABEL: Record<TodoPriority, string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
}

/** 优先级标记色：红（高）/ 黄（中）/ 绿（低）。 */
export const TODO_PRIORITY_COLOR: Record<TodoPriority, string> = {
  high: '#e5484d',
  medium: '#eab308',
  low: '#22a06b',
}

export function isTodoPriority(value: unknown): value is TodoPriority {
  return value === 'high' || value === 'medium' || value === 'low'
}

/** 把任意输入规整为合法优先级。 */
export function normalizeTodoPriority(
  value: unknown,
  fallback: TodoPriority = 'medium'
): TodoPriority {
  return isTodoPriority(value) ? value : fallback
}

let todoSeq = 0

/** 生成待办 id。 */
export function createTodoId(): string {
  todoSeq += 1
  return `todo-${Date.now().toString(36)}-${todoSeq}`
}

/** 校验并整理存储中的待办数组，丢弃非法项。 */
export function sanitizeTodoItems(raw: unknown): TodoItem[] {
  if (!Array.isArray(raw)) return []
  const items: TodoItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Partial<TodoItem>
    if (typeof item.url !== 'string' || !item.url.trim()) continue
    items.push({
      id: typeof item.id === 'string' && item.id ? item.id : createTodoId(),
      title: typeof item.title === 'string' && item.title.trim() ? item.title : item.url,
      url: item.url,
      priority: normalizeTodoPriority(item.priority),
      done: item.done === true,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
    })
  }
  return items
}

/** 按优先级分组（高 -> 中 -> 低），组内保持原有顺序。 */
export function groupTodosByPriority(
  todos: TodoItem[]
): { priority: TodoPriority; items: TodoItem[] }[] {
  const groups = new Map<TodoPriority, TodoItem[]>()
  for (const priority of TODO_PRIORITY_ORDER) groups.set(priority, [])
  for (const todo of todos) {
    const bucket = groups.get(todo.priority)
    if (bucket) bucket.push(todo)
    else groups.get('medium')?.push(todo)
  }
  return TODO_PRIORITY_ORDER.map((priority) => ({
    priority,
    items: groups.get(priority) ?? [],
  }))
}

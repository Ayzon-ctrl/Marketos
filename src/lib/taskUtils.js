export const taskPriorityOptions = [
  ['low', 'Niedrig'],
  ['medium', 'Mittel'],
  ['high', 'Hoch']
]

export const taskScopeOptions = [
  ['own', 'Eigene ToDos'],
  ['team', 'Team ToDos']
]

const STORAGE_KEY = 'marketos-task-meta-v1'

function readTaskMetaStore() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeTaskMetaStore(value) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export function persistTaskMeta(taskId, meta) {
  if (!taskId) return
  const store = readTaskMetaStore()
  store[taskId] = {
    priority: meta.priority || 'medium',
    scope: meta.scope || 'own'
  }
  writeTaskMetaStore(store)
}

export function mergeTaskMetadata(tasks, taskSchemaReady) {
  const store = readTaskMetaStore()
  return (tasks || []).map(task => ({
    ...task,
    priority: taskSchemaReady ? task.priority || 'medium' : store[task.id]?.priority || 'medium',
    scope: taskSchemaReady ? task.scope || 'own' : store[task.id]?.scope || 'own'
  }))
}

export function getTaskPriorityLabel(priority) {
  return taskPriorityOptions.find(([value]) => value === priority)?.[1] || 'Mittel'
}

export function getTaskScopeLabel(scope) {
  return taskScopeOptions.find(([value]) => value === scope)?.[1] || 'Eigene ToDos'
}

export function getTaskPriorityClass(priority) {
  if (priority === 'high') return 'pill bad'
  if (priority === 'medium') return 'pill warn'
  return 'pill'
}

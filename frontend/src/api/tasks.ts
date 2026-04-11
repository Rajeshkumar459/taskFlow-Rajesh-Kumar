import { apiFetch } from './client'
import type { Task, TaskStatus, Priority } from '../types'

export interface TaskFilters {
  status?: TaskStatus
  assignee?: string
}

export interface CreateTaskData {
  title: string
  description?: string
  status?: TaskStatus
  priority?: Priority
  assignee_id?: string
  due_date?: string
}

export interface UpdateTaskData {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: Priority
  assignee_id?: string
  due_date?: string
}

export function getTasks(projectId: string, filters: TaskFilters = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.assignee) params.set('assignee', filters.assignee)
  const qs = params.toString()
  return apiFetch<Task[]>(`/projects/${projectId}/tasks${qs ? `?${qs}` : ''}`)
}

export function createTask(projectId: string, data: CreateTaskData) {
  return apiFetch<Task>(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTask(taskId: string, data: UpdateTaskData) {
  return apiFetch<Task>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteTask(taskId: string) {
  return apiFetch<void>(`/tasks/${taskId}`, { method: 'DELETE' })
}

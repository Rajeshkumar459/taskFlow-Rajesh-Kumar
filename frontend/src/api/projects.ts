import { apiFetch } from './client'
import type { Project, ProjectDetail, ProjectStats } from '../types'

export function getProjects() {
  return apiFetch<Project[]>('/projects')
}

export function createProject(name: string, description?: string) {
  return apiFetch<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  })
}

export function getProject(id: string) {
  return apiFetch<ProjectDetail>(`/projects/${id}`)
}

export function updateProject(id: string, data: { name?: string; description?: string }) {
  return apiFetch<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function deleteProject(id: string) {
  return apiFetch<void>(`/projects/${id}`, { method: 'DELETE' })
}

export function getProjectStats(id: string) {
  return apiFetch<ProjectStats>(`/projects/${id}/stats`)
}

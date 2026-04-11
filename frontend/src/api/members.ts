import { apiFetch } from './client'
import type { ProjectMember, MemberRole } from '../types'

export function getMembers(projectId: string) {
  return apiFetch<ProjectMember[]>(`/projects/${projectId}/members`)
}

export function addMember(projectId: string, userId: string, role: MemberRole) {
  return apiFetch<ProjectMember>(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role }),
  })
}

export function updateMemberRole(projectId: string, userId: string, role: MemberRole) {
  return apiFetch<ProjectMember>(`/projects/${projectId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}

export function removeMember(projectId: string, userId: string) {
  return apiFetch<void>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' })
}

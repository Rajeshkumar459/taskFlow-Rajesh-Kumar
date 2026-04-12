export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type Priority = 'low' | 'medium' | 'high'
export type MemberRole = 'admin' | 'member'

export interface User {
  id: string
  name: string
  email: string
}

export interface Project {
  id: string
  name: string
  description?: string
  owner_id: string
  created_at: string
}

export interface ProjectMember {
  project_id: string
  user_id: string
  role: MemberRole
  name: string
  email: string
  joined_at: string
}

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: Priority
  project_id: string
  assignee_id?: string
  due_date?: string
  created_at: string
  updated_at: string
}

export interface ProjectDetail {
  project: Project
  tasks: Task[]
  members: ProjectMember[]
}

export interface AuthResponse {
  token: string
  user: User
}

export interface StatusCount {
  status: TaskStatus
  count: number
}

export interface AssigneeCount {
  assignee_id?: string
  assignee_name?: string
  count: number
}

export interface ProjectStats {
  by_status: StatusCount[]
  by_assignee: AssigneeCount[]
  overdue_count: number
}

export interface ApiError {
  error: string
  fields?: Record<string, string>
}

export interface TaskCounts {
  todo: number
  in_progress: number
  done: number
  total: number
  overdue: number
}

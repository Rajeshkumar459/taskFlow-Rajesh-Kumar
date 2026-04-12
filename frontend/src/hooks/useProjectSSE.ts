import { useEffect, useRef } from 'react'
import { BASE_URL, TOKEN_KEY } from '../api/client'
import type { Task, ProjectMember } from '../types'

type SSEEvent =
  | { type: 'task_created'; payload: Task }
  | { type: 'task_updated'; payload: Task }
  | { type: 'task_deleted'; payload: { task_id: string } }
  | { type: 'member_added'; payload: ProjectMember }
  | { type: 'member_updated'; payload: ProjectMember }
  | { type: 'member_removed'; payload: { user_id: string } }
  | { type: 'connected' }

export interface SSEHandlers {
  onTaskCreated: (task: Task) => void
  onTaskUpdated: (task: Task) => void
  onTaskDeleted: (taskId: string) => void
  onMemberAdded: (member: ProjectMember) => void
  onMemberUpdated: (member: ProjectMember) => void
  onMemberRemoved: (userId: string) => void
}

/**
 * Subscribes to the project SSE stream for real-time updates.
 * Uses SSE (Server-Sent Events) — one-directional server→client push.
 * Re-connects only when the projectId changes; always calls the latest handlers.
 */
export function useProjectSSE(projectId: string | undefined, handlers: SSEHandlers) {
  // Keep a stable ref so we always call the latest handlers without re-subscribing
  const handlersRef = useRef<SSEHandlers>(handlers)
  useEffect(() => { handlersRef.current = handlers })

  useEffect(() => {
    if (!projectId) return
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    const url = `${BASE_URL}/projects/${projectId}/events?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)

    es.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data) as SSEEvent
        const h = handlersRef.current
        switch (msg.type) {
          case 'task_created':  h.onTaskCreated(msg.payload); break
          case 'task_updated':  h.onTaskUpdated(msg.payload); break
          case 'task_deleted':  h.onTaskDeleted(msg.payload.task_id); break
          case 'member_added':  h.onMemberAdded(msg.payload); break
          case 'member_updated': h.onMemberUpdated(msg.payload); break
          case 'member_removed': h.onMemberRemoved(msg.payload.user_id); break
        }
      } catch { /* ignore malformed messages */ }
    }

    return () => es.close()
  }, [projectId]) // Only re-subscribe when the project changes
}

package com.taskflow.service;

import com.taskflow.dto.TaskPatchRequest;
import com.taskflow.dto.TaskRequest;
import com.taskflow.dto.TaskResponse;
import com.taskflow.exception.AppException;
import com.taskflow.model.Task;
import com.taskflow.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final SseBroker sseBroker;

    public List<TaskResponse> listTasks(UUID projectId, String status, String assigneeParam) {
        List<Task> tasks;

        if ("unassigned".equals(assigneeParam)) {
            String statusFilter = (status != null && !status.isBlank()) ? status : null;
            tasks = taskRepository.findByProjectIdUnassigned(projectId, statusFilter);
        } else {
            String statusFilter = (status != null && !status.isBlank()) ? status : null;
            UUID assigneeFilter = null;
            if (assigneeParam != null && !assigneeParam.isBlank()) {
                try {
                    assigneeFilter = UUID.fromString(assigneeParam);
                } catch (IllegalArgumentException e) {
                    throw AppException.badRequest("invalid assignee UUID");
                }
            }
            tasks = taskRepository.findByProjectIdWithFilters(projectId, statusFilter, assigneeFilter);
        }

        return tasks.stream().map(TaskResponse::from).toList();
    }

    public TaskResponse createTask(UUID projectId, TaskRequest req) {
        Task task = new Task();
        task.setProjectId(projectId);
        task.setTitle(req.title());
        task.setDescription(req.description());
        if (req.status() != null) task.setStatus(req.status());
        if (req.priority() != null) task.setPriority(req.priority());
        task.setAssigneeId(req.assigneeId());
        task.setDueDate(req.dueDate());

        task = taskRepository.save(task);
        TaskResponse response = TaskResponse.from(task);
        sseBroker.publish(projectId, "task_created", response);
        return response;
    }

    public TaskResponse updateTask(UUID taskId, TaskPatchRequest req) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> AppException.notFound("task not found"));

        if (req.title() != null) task.setTitle(req.title());
        if (req.description() != null) task.setDescription(req.description());
        if (req.status() != null) task.setStatus(req.status());
        if (req.priority() != null) task.setPriority(req.priority());
        if (req.assigneeId() != null) task.setAssigneeId(req.assigneeId());
        if (req.dueDate() != null) task.setDueDate(req.dueDate());

        task = taskRepository.save(task);
        TaskResponse response = TaskResponse.from(task);
        sseBroker.publish(task.getProjectId(), "task_updated", response);
        return response;
    }

    public void deleteTask(UUID taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> AppException.notFound("task not found"));
        taskRepository.delete(task);
        sseBroker.publish(task.getProjectId(), "task_deleted", taskId);
    }

    public Task getTask(UUID taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> AppException.notFound("task not found"));
    }

    public List<TaskResponse> getTasksForProject(UUID projectId) {
        return taskRepository.findByProjectIdOrderByCreatedAtAsc(projectId)
                .stream().map(TaskResponse::from).toList();
    }
}

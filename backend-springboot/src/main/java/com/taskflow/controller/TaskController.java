package com.taskflow.controller;

import com.taskflow.dto.TaskPatchRequest;
import com.taskflow.dto.TaskRequest;
import com.taskflow.dto.TaskResponse;
import com.taskflow.model.Task;
import com.taskflow.service.ProjectService;
import com.taskflow.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;
    private final ProjectService projectService;

    @GetMapping("/projects/{projectId}/tasks")
    public List<TaskResponse> list(@AuthenticationPrincipal UUID userId,
                                   @PathVariable UUID projectId,
                                   @RequestParam(required = false) String status,
                                   @RequestParam(required = false) String assignee) {
        projectService.requireMember(projectId, userId);
        return taskService.listTasks(projectId, status, assignee);
    }

    @PostMapping("/projects/{projectId}/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(@AuthenticationPrincipal UUID userId,
                               @PathVariable UUID projectId,
                               @Valid @RequestBody TaskRequest req) {
        projectService.requireMember(projectId, userId);
        return taskService.createTask(projectId, req);
    }

    @PatchMapping("/tasks/{id}")
    public TaskResponse update(@AuthenticationPrincipal UUID userId,
                               @PathVariable UUID id,
                               @Valid @RequestBody TaskPatchRequest req) {
        Task task = taskService.getTask(id);
        projectService.requireMember(task.getProjectId(), userId);
        return taskService.updateTask(id, req);
    }

    @DeleteMapping("/tasks/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UUID userId,
                       @PathVariable UUID id) {
        Task task = taskService.getTask(id);
        projectService.requireAdmin(task.getProjectId(), userId);
        taskService.deleteTask(id);
    }
}

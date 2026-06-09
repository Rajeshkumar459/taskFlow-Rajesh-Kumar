package com.taskflow.controller;

import com.taskflow.dto.*;
import com.taskflow.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    public List<ProjectResponse> list(@AuthenticationPrincipal UUID userId) {
        return projectService.listProjects(userId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectResponse create(@AuthenticationPrincipal UUID userId,
                                  @Valid @RequestBody ProjectRequest req) {
        return projectService.createProject(userId, req);
    }

    @GetMapping("/{id}")
    public ProjectDetailResponse get(@AuthenticationPrincipal UUID userId,
                                     @PathVariable UUID id) {
        return projectService.getProject(id, userId);
    }

    @PatchMapping("/{id}")
    public ProjectResponse update(@AuthenticationPrincipal UUID userId,
                                  @PathVariable UUID id,
                                  @RequestBody ProjectRequest req) {
        return projectService.updateProject(id, userId, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UUID userId,
                       @PathVariable UUID id) {
        projectService.deleteProject(id, userId);
    }

    @GetMapping("/{id}/stats")
    public ProjectStats stats(@AuthenticationPrincipal UUID userId,
                              @PathVariable UUID id) {
        return projectService.getStats(id, userId);
    }
}

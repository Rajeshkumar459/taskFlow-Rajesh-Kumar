package com.taskflow.controller;

import com.taskflow.service.ProjectService;
import com.taskflow.service.SseBroker;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class SseController {

    private final SseBroker sseBroker;
    private final ProjectService projectService;

    @GetMapping("/projects/{projectId}/events")
    public SseEmitter subscribe(@AuthenticationPrincipal UUID userId,
                                @PathVariable UUID projectId) {
        projectService.requireMember(projectId, userId);
        return sseBroker.subscribe(projectId);
    }
}

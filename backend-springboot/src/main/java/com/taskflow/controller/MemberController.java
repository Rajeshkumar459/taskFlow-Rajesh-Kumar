package com.taskflow.controller;

import com.taskflow.dto.MemberRequest;
import com.taskflow.dto.MemberResponse;
import com.taskflow.dto.MemberRoleRequest;
import com.taskflow.service.MemberService;
import com.taskflow.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/projects/{projectId}/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;
    private final ProjectService projectService;

    @GetMapping
    public List<MemberResponse> list(@AuthenticationPrincipal UUID userId,
                                     @PathVariable UUID projectId) {
        projectService.requireMember(projectId, userId);
        return memberService.getMembers(projectId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MemberResponse add(@AuthenticationPrincipal UUID userId,
                              @PathVariable UUID projectId,
                              @Valid @RequestBody MemberRequest req) {
        projectService.requireAdmin(projectId, userId);
        return memberService.addMember(projectId, req);
    }

    @PatchMapping("/{targetUserId}")
    public MemberResponse updateRole(@AuthenticationPrincipal UUID userId,
                                     @PathVariable UUID projectId,
                                     @PathVariable UUID targetUserId,
                                     @Valid @RequestBody MemberRoleRequest req) {
        projectService.requireAdmin(projectId, userId);
        return memberService.updateRole(projectId, targetUserId, req);
    }

    @DeleteMapping("/{targetUserId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal UUID userId,
                       @PathVariable UUID projectId,
                       @PathVariable UUID targetUserId) {
        projectService.requireAdmin(projectId, userId);
        memberService.removeMember(projectId, targetUserId);
    }
}

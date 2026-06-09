package com.taskflow.dto;

import com.taskflow.repository.projection.MemberView;

import java.time.OffsetDateTime;
import java.util.UUID;

public record MemberResponse(
        UUID projectId,
        UUID userId,
        String name,
        String email,
        String role,
        OffsetDateTime joinedAt
) {
    public static MemberResponse from(MemberView v) {
        return new MemberResponse(v.getProjectId(), v.getUserId(), v.getName(), v.getEmail(), v.getRole(), v.getJoinedAt());
    }
}

package com.taskflow.dto;

import com.taskflow.model.Project;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record ProjectDetailResponse(
        UUID id,
        String name,
        String description,
        UUID ownerId,
        OffsetDateTime createdAt,
        List<TaskResponse> tasks,
        List<MemberResponse> members
) {
    public static ProjectDetailResponse from(Project p, List<TaskResponse> tasks, List<MemberResponse> members) {
        return new ProjectDetailResponse(
                p.getId(), p.getName(), p.getDescription(), p.getOwnerId(), p.getCreatedAt(),
                tasks, members
        );
    }
}

package com.taskflow.dto;

import com.taskflow.model.Project;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        String name,
        String description,
        UUID ownerId,
        OffsetDateTime createdAt
) {
    public static ProjectResponse from(Project p) {
        return new ProjectResponse(p.getId(), p.getName(), p.getDescription(), p.getOwnerId(), p.getCreatedAt());
    }
}

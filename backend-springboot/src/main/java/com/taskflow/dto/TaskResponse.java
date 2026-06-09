package com.taskflow.dto;

import com.taskflow.model.Task;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record TaskResponse(
        UUID id,
        String title,
        String description,
        String status,
        String priority,
        UUID projectId,
        UUID assigneeId,
        LocalDate dueDate,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static TaskResponse from(Task t) {
        return new TaskResponse(
                t.getId(), t.getTitle(), t.getDescription(),
                t.getStatus(), t.getPriority(), t.getProjectId(),
                t.getAssigneeId(), t.getDueDate(), t.getCreatedAt(), t.getUpdatedAt()
        );
    }
}

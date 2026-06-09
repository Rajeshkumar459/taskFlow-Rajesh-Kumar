package com.taskflow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.time.LocalDate;
import java.util.UUID;

public record TaskRequest(
        @NotBlank String title,
        String description,
        @Pattern(regexp = "^(todo|in_progress|done)$", message = "must be one of: todo, in_progress, done")
        String status,
        @Pattern(regexp = "^(low|medium|high)$", message = "must be one of: low, medium, high")
        String priority,
        UUID assigneeId,
        LocalDate dueDate
) {}

package com.taskflow.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record MemberRequest(
        @NotNull UUID userId,
        String role
) {}

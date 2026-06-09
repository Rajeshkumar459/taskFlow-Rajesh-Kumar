package com.taskflow.dto;

import jakarta.validation.constraints.NotBlank;

public record MemberRoleRequest(@NotBlank String role) {}

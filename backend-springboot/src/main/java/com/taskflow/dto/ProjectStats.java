package com.taskflow.dto;

import java.util.List;
import java.util.UUID;

public record ProjectStats(
        List<StatusCount> byStatus,
        List<AssigneeCount> byAssignee,
        int overdueCount
) {
    public record StatusCount(String status, long count) {}

    public record AssigneeCount(UUID assigneeId, String name, long count) {}
}

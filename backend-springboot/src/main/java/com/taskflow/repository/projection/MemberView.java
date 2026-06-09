package com.taskflow.repository.projection;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface MemberView {
    UUID getProjectId();
    UUID getUserId();
    String getName();
    String getEmail();
    String getRole();
    OffsetDateTime getJoinedAt();
}

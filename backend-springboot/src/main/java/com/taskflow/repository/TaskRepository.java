package com.taskflow.repository;

import com.taskflow.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID>, JpaSpecificationExecutor<Task> {

    List<Task> findByProjectIdOrderByCreatedAtAsc(UUID projectId);

    @Query("""
            SELECT t FROM Task t
            WHERE t.projectId = :projectId
            AND (:status IS NULL OR t.status = :status)
            AND (:assignee IS NULL OR t.assigneeId = :assignee)
            ORDER BY t.createdAt ASC
            """)
    List<Task> findByProjectIdWithFilters(
            @Param("projectId") UUID projectId,
            @Param("status") String status,
            @Param("assignee") UUID assignee
    );

    @Query("""
            SELECT t FROM Task t
            WHERE t.projectId = :projectId
            AND (:status IS NULL OR t.status = :status)
            AND t.assigneeId IS NULL
            ORDER BY t.createdAt ASC
            """)
    List<Task> findByProjectIdUnassigned(
            @Param("projectId") UUID projectId,
            @Param("status") String status
    );

    void deleteByProjectId(UUID projectId);
}

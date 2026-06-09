package com.taskflow.repository;

import com.taskflow.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

    @Query("""
            SELECT p FROM Project p
            JOIN ProjectMember pm ON pm.id.projectId = p.id
            WHERE pm.id.userId = :userId
            ORDER BY p.createdAt DESC
            """)
    List<Project> findAllByMemberUserId(@Param("userId") UUID userId);
}

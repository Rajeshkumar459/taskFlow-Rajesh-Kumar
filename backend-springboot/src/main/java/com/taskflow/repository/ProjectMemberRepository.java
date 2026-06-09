package com.taskflow.repository;

import com.taskflow.model.ProjectMember;
import com.taskflow.model.ProjectMemberId;
import com.taskflow.repository.projection.MemberView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, ProjectMemberId> {

    boolean existsById(ProjectMemberId id);

    Optional<ProjectMember> findById(ProjectMemberId id);

    @Query("""
            SELECT pm.id.projectId AS projectId, pm.id.userId AS userId,
                   u.name AS name, u.email AS email,
                   pm.role AS role, pm.joinedAt AS joinedAt
            FROM ProjectMember pm
            JOIN User u ON u.id = pm.id.userId
            WHERE pm.id.projectId = :projectId
            ORDER BY pm.joinedAt ASC
            """)
    List<MemberView> findMembersWithDetails(@Param("projectId") UUID projectId);

    @Query("SELECT COUNT(pm) FROM ProjectMember pm WHERE pm.id.projectId = :projectId AND pm.role = 'admin'")
    long countAdmins(@Param("projectId") UUID projectId);

    boolean existsByIdProjectIdAndIdUserId(UUID projectId, UUID userId);

    List<ProjectMember> findByIdProjectId(UUID projectId);
}

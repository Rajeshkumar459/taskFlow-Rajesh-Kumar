package com.taskflow.service;

import com.taskflow.dto.*;
import com.taskflow.exception.AppException;
import com.taskflow.model.Project;
import com.taskflow.model.ProjectMember;
import com.taskflow.model.ProjectMemberId;
import com.taskflow.model.Task;
import com.taskflow.repository.ProjectMemberRepository;
import com.taskflow.repository.ProjectRepository;
import com.taskflow.repository.TaskRepository;
import com.taskflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    public List<ProjectResponse> listProjects(UUID userId) {
        return projectRepository.findAllByMemberUserId(userId).stream()
                .map(ProjectResponse::from)
                .toList();
    }

    @Transactional
    public ProjectResponse createProject(UUID ownerId, ProjectRequest req) {
        Project project = new Project();
        project.setName(req.name());
        project.setDescription(req.description());
        project.setOwnerId(ownerId);
        project = projectRepository.save(project);

        ProjectMember ownerMembership = new ProjectMember();
        ownerMembership.setId(new ProjectMemberId(project.getId(), ownerId));
        ownerMembership.setRole("admin");
        memberRepository.save(ownerMembership);

        return ProjectResponse.from(project);
    }

    public ProjectDetailResponse getProject(UUID projectId, UUID requestingUserId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("project not found"));

        if (!memberRepository.existsById(new ProjectMemberId(projectId, requestingUserId))) {
            throw AppException.forbidden("not a member of this project");
        }

        List<TaskResponse> tasks = taskRepository.findByProjectIdOrderByCreatedAtAsc(projectId)
                .stream().map(TaskResponse::from).toList();

        List<MemberResponse> members = memberRepository.findMembersWithDetails(projectId).stream()
                .map(MemberResponse::from).toList();

        return ProjectDetailResponse.from(project, tasks, members);
    }

    public ProjectResponse updateProject(UUID projectId, UUID userId, ProjectRequest req) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("project not found"));

        requireAdmin(projectId, userId);

        if (req.name() != null) project.setName(req.name());
        if (req.description() != null) project.setDescription(req.description());

        return ProjectResponse.from(projectRepository.save(project));
    }

    @Transactional
    public void deleteProject(UUID projectId, UUID userId) {
        projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("project not found"));

        requireAdmin(projectId, userId);
        projectRepository.deleteById(projectId);
    }

    public ProjectStats getStats(UUID projectId, UUID userId) {
        projectRepository.findById(projectId)
                .orElseThrow(() -> AppException.notFound("project not found"));

        if (!memberRepository.existsById(new ProjectMemberId(projectId, userId))) {
            throw AppException.forbidden("not a member of this project");
        }

        List<Task> allTasks = taskRepository.findByProjectIdOrderByCreatedAtAsc(projectId);

        // by_status
        Map<String, Long> statusMap = allTasks.stream()
                .collect(Collectors.groupingBy(Task::getStatus, Collectors.counting()));
        List<ProjectStats.StatusCount> byStatus = statusMap.entrySet().stream()
                .map(e -> new ProjectStats.StatusCount(e.getKey(), e.getValue()))
                .toList();

        // by_assignee — group by assignee_id, null = unassigned
        Map<UUID, List<Task>> assigneeMap = allTasks.stream()
                .collect(Collectors.groupingBy(
                        t -> t.getAssigneeId() != null ? t.getAssigneeId() : UUID.fromString("00000000-0000-0000-0000-000000000000"),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<ProjectStats.AssigneeCount> byAssignee = new ArrayList<>();
        for (Map.Entry<UUID, List<Task>> entry : assigneeMap.entrySet()) {
            UUID assigneeId = entry.getKey();
            long count = entry.getValue().size();
            String name = null;
            if (!assigneeId.equals(UUID.fromString("00000000-0000-0000-0000-000000000000"))) {
                name = userRepository.findById(assigneeId).map(u -> u.getName()).orElse(null);
            } else {
                assigneeId = null;
            }
            byAssignee.add(new ProjectStats.AssigneeCount(assigneeId, name, count));
        }

        // overdue: due_date < today AND status != done
        LocalDate today = LocalDate.now();
        int overdueCount = (int) allTasks.stream()
                .filter(t -> t.getDueDate() != null
                        && t.getDueDate().isBefore(today)
                        && !"done".equals(t.getStatus()))
                .count();

        return new ProjectStats(byStatus, byAssignee, overdueCount);
    }

    public void requireAdmin(UUID projectId, UUID userId) {
        String role = memberRepository.findById(new ProjectMemberId(projectId, userId))
                .map(ProjectMember::getRole)
                .orElseThrow(() -> AppException.forbidden("not a member of this project"));
        if (!"admin".equals(role)) {
            throw AppException.forbidden("admin role required");
        }
    }

    public void requireMember(UUID projectId, UUID userId) {
        if (!memberRepository.existsById(new ProjectMemberId(projectId, userId))) {
            throw AppException.forbidden("not a member of this project");
        }
    }
}

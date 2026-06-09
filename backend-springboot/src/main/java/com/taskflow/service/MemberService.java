package com.taskflow.service;

import com.taskflow.dto.MemberRequest;
import com.taskflow.dto.MemberResponse;
import com.taskflow.dto.MemberRoleRequest;
import com.taskflow.exception.AppException;
import com.taskflow.model.ProjectMember;
import com.taskflow.model.ProjectMemberId;
import com.taskflow.repository.ProjectMemberRepository;
import com.taskflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MemberService {

    private final ProjectMemberRepository memberRepository;
    private final UserRepository userRepository;

    public List<MemberResponse> getMembers(UUID projectId) {
        return memberRepository.findMembersWithDetails(projectId).stream()
                .map(MemberResponse::from)
                .toList();
    }

    public MemberResponse addMember(UUID projectId, MemberRequest req) {
        ProjectMemberId memberId = new ProjectMemberId(projectId, req.userId());

        if (memberRepository.existsById(memberId)) {
            throw AppException.conflict("user is already a member of this project");
        }

        userRepository.findById(req.userId())
                .orElseThrow(() -> AppException.notFound("user not found"));

        ProjectMember member = new ProjectMember();
        member.setId(memberId);
        member.setRole(req.role() != null ? req.role() : "member");
        memberRepository.save(member);

        return memberRepository.findMembersWithDetails(projectId).stream()
                .filter(v -> v.getUserId().equals(req.userId()))
                .map(MemberResponse::from)
                .findFirst()
                .orElseThrow();
    }

    private static final java.util.Set<String> VALID_ROLES = java.util.Set.of("admin", "member");

    public MemberResponse updateRole(UUID projectId, UUID userId, MemberRoleRequest req) {
        if (!VALID_ROLES.contains(req.role())) {
            throw AppException.badRequest("role must be 'admin' or 'member'");
        }
        ProjectMemberId memberId = new ProjectMemberId(projectId, userId);
        ProjectMember member = memberRepository.findById(memberId)
                .orElseThrow(() -> AppException.notFound("member not found"));

        if ("member".equals(req.role()) && "admin".equals(member.getRole())) {
            long adminCount = memberRepository.countAdmins(projectId);
            if (adminCount <= 1) {
                throw AppException.badRequest("cannot remove the last admin");
            }
        }

        member.setRole(req.role());
        memberRepository.save(member);

        return memberRepository.findMembersWithDetails(projectId).stream()
                .filter(v -> v.getUserId().equals(userId))
                .map(MemberResponse::from)
                .findFirst()
                .orElseThrow();
    }

    public void removeMember(UUID projectId, UUID userId) {
        ProjectMemberId memberId = new ProjectMemberId(projectId, userId);
        ProjectMember member = memberRepository.findById(memberId)
                .orElseThrow(() -> AppException.notFound("member not found"));

        if ("admin".equals(member.getRole())) {
            long adminCount = memberRepository.countAdmins(projectId);
            if (adminCount <= 1) {
                throw AppException.badRequest("cannot remove the last admin");
            }
        }

        memberRepository.delete(member);
    }

    public String getMemberRole(UUID projectId, UUID userId) {
        return memberRepository.findById(new ProjectMemberId(projectId, userId))
                .map(ProjectMember::getRole)
                .orElse(null);
    }

    public boolean isMember(UUID projectId, UUID userId) {
        return memberRepository.existsById(new ProjectMemberId(projectId, userId));
    }
}

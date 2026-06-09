package com.taskflow;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class MemberControllerTest extends AbstractIntegrationTest {

    @Test
    void add_and_list_members() throws Exception {
        String adminToken = mustRegister("Adm", uniqueEmail("addmem"), "password123");
        String memberEmail = uniqueEmail("newmem");
        String memberToken = mustRegister("Mem", memberEmail, "password123");
        String projectId = mustCreateProject(adminToken, "Member Project");

        String memberId = getUserId(memberToken, memberEmail, "password123");

        MvcResult addR = doPost("/projects/" + projectId + "/members",
                Map.of("user_id", memberId, "role", "member"), adminToken);
        assertThat(status(addR)).isEqualTo(201);
        assertThat(body(addR).get("role")).isEqualTo("member");

        MvcResult listR = doGet("/projects/" + projectId + "/members", adminToken);
        assertThat(status(listR)).isEqualTo(200);

        List<Map<String, Object>> members = bodyList(listR);
        boolean found = members.stream().anyMatch(m -> memberId.equals(m.get("user_id")));
        assertThat(found).isTrue();
    }

    @Test
    void add_duplicate_member_returns_409() throws Exception {
        String adminToken = mustRegister("DupAdm", uniqueEmail("dupadm"), "password123");
        String dupEmail = uniqueEmail("dupuser");
        String dupToken = mustRegister("DupUser", dupEmail, "password123");
        String projectId = mustCreateProject(adminToken, "Dup Member Project");

        String memberId = getUserId(dupToken, dupEmail, "password123");
        doPost("/projects/" + projectId + "/members",
                Map.of("user_id", memberId, "role", "member"), adminToken);

        MvcResult r = doPost("/projects/" + projectId + "/members",
                Map.of("user_id", memberId, "role", "member"), adminToken);
        assertThat(status(r)).isEqualTo(409);
    }

    @Test
    void non_admin_cannot_add_member() throws Exception {
        String adminToken = mustRegister("RealAdm", uniqueEmail("realadm"), "password123");
        String memberEmail = uniqueEmail("regmem");
        String memberToken = mustRegister("RegMem", memberEmail, "password123");
        String outsiderEmail = uniqueEmail("outsider");
        String outsiderToken = mustRegister("Outsider", outsiderEmail, "password123");
        String projectId = mustCreateProject(adminToken, "Access Control Project");

        String memberId = getUserId(memberToken, memberEmail, "password123");
        doPost("/projects/" + projectId + "/members",
                Map.of("user_id", memberId, "role", "member"), adminToken);

        String outsiderId = getUserId(outsiderToken, outsiderEmail, "password123");
        MvcResult r = doPost("/projects/" + projectId + "/members",
                Map.of("user_id", outsiderId, "role", "member"), memberToken);
        assertThat(status(r)).isEqualTo(403);
    }

    @Test
    void promote_member_to_admin() throws Exception {
        String adminToken = mustRegister("RoleAdm", uniqueEmail("roleadm"), "password123");
        String memberEmail = uniqueEmail("rolemem");
        String memberToken = mustRegister("RoleMem", memberEmail, "password123");
        String projectId = mustCreateProject(adminToken, "Role Update Project");

        String memberId = getUserId(memberToken, memberEmail, "password123");
        doPost("/projects/" + projectId + "/members",
                Map.of("user_id", memberId, "role", "member"), adminToken);

        MvcResult r = doPatch("/projects/" + projectId + "/members/" + memberId,
                Map.of("role", "admin"), adminToken);
        assertThat(status(r)).isEqualTo(200);
        assertThat(body(r).get("role")).isEqualTo("admin");
    }

    @Test
    void update_role_with_invalid_value_returns_400() throws Exception {
        String adminToken = mustRegister("BadRole", uniqueEmail("badrole"), "password123");
        String memberEmail = uniqueEmail("badrolemem");
        String memberToken = mustRegister("BadMem", memberEmail, "password123");
        String projectId = mustCreateProject(adminToken, "Bad Role Project");

        String memberId = getUserId(memberToken, memberEmail, "password123");
        doPost("/projects/" + projectId + "/members",
                Map.of("user_id", memberId, "role", "member"), adminToken);

        MvcResult r = doPatch("/projects/" + projectId + "/members/" + memberId,
                Map.of("role", "superadmin"), adminToken);
        assertThat(status(r)).isEqualTo(400);
    }

    @Test
    void remove_last_admin_returns_400() throws Exception {
        String selfEmail = uniqueEmail("selfadm");
        String selfToken = mustRegister("SelfAdm", selfEmail, "password123");
        String selfProjectId = mustCreateProject(selfToken, "Self Admin Project");
        String selfId = getUserId(selfToken, selfEmail, "password123");

        MvcResult r = doDelete("/projects/" + selfProjectId + "/members/" + selfId, selfToken);
        assertThat(status(r)).isEqualTo(400);
    }

    @Test
    void remove_member_as_admin_succeeds() throws Exception {
        String adminToken = mustRegister("RemAdm", uniqueEmail("remadm"), "password123");
        String memberEmail = uniqueEmail("remmem");
        String memberToken = mustRegister("RemMem", memberEmail, "password123");
        String projectId = mustCreateProject(adminToken, "Remove Member Project");

        String memberId = getUserId(memberToken, memberEmail, "password123");
        doPost("/projects/" + projectId + "/members",
                Map.of("user_id", memberId, "role", "member"), adminToken);

        MvcResult r = doDelete("/projects/" + projectId + "/members/" + memberId, adminToken);
        assertThat(status(r)).isEqualTo(204);

        List<Map<String, Object>> members = bodyList(doGet("/projects/" + projectId + "/members", adminToken));
        boolean stillPresent = members.stream().anyMatch(m -> memberId.equals(m.get("user_id")));
        assertThat(stillPresent).isFalse();
    }

    @Test
    void non_member_cannot_list_members() throws Exception {
        String ownerToken = mustRegister("OwnerM", uniqueEmail("ownerm"), "password123");
        String outsiderToken = mustRegister("OutM", uniqueEmail("outm"), "password123");
        String projectId = mustCreateProject(ownerToken, "Private Member Project");

        MvcResult r = doGet("/projects/" + projectId + "/members", outsiderToken);
        assertThat(status(r)).isEqualTo(403);
    }
}

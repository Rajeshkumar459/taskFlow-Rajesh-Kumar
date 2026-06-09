package com.taskflow;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectControllerTest extends AbstractIntegrationTest {

    @Test
    void create_and_list_projects() throws Exception {
        String token = mustRegister("Dave", uniqueEmail("projlist"), "password123");
        String projectId = mustCreateProject(token, "Test Project");

        List<Map<String, Object>> projects = bodyList(doGet("/projects", token));
        boolean found = projects.stream().anyMatch(p -> projectId.equals(p.get("id")));
        assertThat(found).isTrue();
    }

    @Test
    void create_project_with_empty_name_returns_400() throws Exception {
        String token = mustRegister("Eve", uniqueEmail("projval"), "password123");
        MvcResult r = doPost("/projects", Map.of("name", ""), token);
        assertThat(status(r)).isEqualTo(400);
        assertThat(body(r).get("fields")).isNotNull();
    }

    @Test
    void get_project_detail_includes_tasks_and_members() throws Exception {
        String token = mustRegister("Frank", uniqueEmail("projget"), "password123");
        String projectId = mustCreateProject(token, "Detail Project");
        mustCreateTask(token, projectId, "Task One");

        MvcResult r = doGet("/projects/" + projectId, token);
        assertThat(status(r)).isEqualTo(200);
        Map<String, Object> b = body(r);
        assertThat(b.get("id")).isEqualTo(projectId);
        assertThat((List<?>) b.get("tasks")).isNotEmpty();
        assertThat((List<?>) b.get("members")).isNotEmpty();
    }

    @Test
    void get_project_by_non_member_returns_403() throws Exception {
        String ownerToken = mustRegister("Grace", uniqueEmail("owner"), "password123");
        String otherToken = mustRegister("Hank", uniqueEmail("nonmember"), "password123");
        String projectId = mustCreateProject(ownerToken, "Private Project");

        assertThat(status(doGet("/projects/" + projectId, otherToken))).isEqualTo(403);
    }

    @Test
    void get_nonexistent_project_returns_404_or_403() throws Exception {
        String token = mustRegister("Ivan", uniqueEmail("p404"), "password123");
        int code = status(doGet("/projects/00000000-0000-0000-0000-000000000099", token));
        assertThat(code).isIn(404, 403);
    }

    @Test
    void update_project_as_admin_returns_updated_name() throws Exception {
        String token = mustRegister("Ivan2", uniqueEmail("projupd"), "password123");
        String projectId = mustCreateProject(token, "Old Name");

        MvcResult r = doPatch("/projects/" + projectId,
                Map.of("name", "New Name", "description", "Updated"), token);
        assertThat(status(r)).isEqualTo(200);
        assertThat(body(r).get("name")).isEqualTo("New Name");
    }

    @Test
    void update_project_as_member_returns_403() throws Exception {
        String adminToken = mustRegister("Jane", uniqueEmail("jadmin"), "password123");
        String memberEmail = uniqueEmail("jmember");
        String memberToken = mustRegister("Kim", memberEmail, "password123");
        String projectId = mustCreateProject(adminToken, "Shared Project");

        String memberId = getUserId(memberToken, memberEmail, "password123");
        doPost("/projects/" + projectId + "/members",
                Map.of("user_id", memberId, "role", "member"), adminToken);

        assertThat(status(doPatch("/projects/" + projectId, Map.of("name", "Hacked"), memberToken)))
                .isEqualTo(403);
    }

    @Test
    void delete_project_as_admin_returns_204() throws Exception {
        String token = mustRegister("Leo", uniqueEmail("projdel"), "password123");
        String projectId = mustCreateProject(token, "To Delete");

        assertThat(status(doDelete("/projects/" + projectId, token))).isEqualTo(204);
        assertThat(status(doGet("/projects/" + projectId, token))).isIn(403, 404);
    }

    @Test
    void delete_project_as_member_returns_403() throws Exception {
        String adminToken = mustRegister("Mia", uniqueEmail("madmin"), "password123");
        String memberEmail = uniqueEmail("mmember");
        String memberToken = mustRegister("Ned", memberEmail, "password123");
        String projectId = mustCreateProject(adminToken, "Protected Project");

        String memberId = getUserId(memberToken, memberEmail, "password123");
        doPost("/projects/" + projectId + "/members",
                Map.of("user_id", memberId, "role", "member"), adminToken);

        assertThat(status(doDelete("/projects/" + projectId, memberToken))).isEqualTo(403);
    }

    @Test
    void project_stats_returns_by_status() throws Exception {
        String token = mustRegister("Olivia", uniqueEmail("stats"), "password123");
        String projectId = mustCreateProject(token, "Stats Project");
        mustCreateTask(token, projectId, "Todo Task");
        String taskId = mustCreateTask(token, projectId, "Done Task");
        doPatch("/tasks/" + taskId, Map.of("status", "done"), token);

        MvcResult r = doGet("/projects/" + projectId + "/stats", token);
        assertThat(status(r)).isEqualTo(200);
        assertThat((List<?>) body(r).get("by_status")).isNotEmpty();
    }
}

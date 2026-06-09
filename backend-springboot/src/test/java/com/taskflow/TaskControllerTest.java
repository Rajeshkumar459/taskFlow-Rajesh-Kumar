package com.taskflow;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TaskControllerTest extends AbstractIntegrationTest {

    @Test
    void create_and_list_tasks() throws Exception {
        String token = mustRegister("Pat", uniqueEmail("tasks"), "password123");
        String projectId = mustCreateProject(token, "Task Project");
        String taskId = mustCreateTask(token, projectId, "My Task");

        List<Map<String, Object>> tasks = bodyList(doGet("/projects/" + projectId + "/tasks", token));
        boolean found = tasks.stream().anyMatch(t -> taskId.equals(t.get("id")));
        assertThat(found).isTrue();
    }

    @Test
    void create_task_default_status_and_priority() throws Exception {
        String token = mustRegister("Quinn", uniqueEmail("taskdef"), "password123");
        String projectId = mustCreateProject(token, "Defaults Project");

        MvcResult r = doPost("/projects/" + projectId + "/tasks", Map.of("title", "Simple"), token);
        assertThat(status(r)).isEqualTo(201);
        Map<String, Object> b = body(r);
        assertThat(b.get("status")).isEqualTo("todo");
        assertThat(b.get("priority")).isEqualTo("medium");
    }

    @Test
    void create_task_with_all_fields() throws Exception {
        String token = mustRegister("Quinn2", uniqueEmail("tasksall"), "password123");
        String projectId = mustCreateProject(token, "Full Task Project");

        MvcResult r = doPost("/projects/" + projectId + "/tasks", Map.of(
                "title", "Full Task",
                "description", "A detailed task",
                "status", "in_progress",
                "priority", "high",
                "due_date", LocalDate.now().plusDays(1).toString()
        ), token);

        assertThat(status(r)).isEqualTo(201);
        Map<String, Object> b = body(r);
        assertThat(b.get("status")).isEqualTo("in_progress");
        assertThat(b.get("priority")).isEqualTo("high");
    }

    @Test
    void create_task_missing_title_returns_400() throws Exception {
        String token = mustRegister("Ray", uniqueEmail("taskval"), "password123");
        String projectId = mustCreateProject(token, "Validation Project");

        MvcResult r = doPost("/projects/" + projectId + "/tasks", Map.of("title", ""), token);
        assertThat(status(r)).isEqualTo(400);
        assertThat(body(r).get("fields")).isNotNull();
    }

    @Test
    void create_task_invalid_status_returns_400() throws Exception {
        String token = mustRegister("Ray2", uniqueEmail("taskbadst"), "password123");
        String projectId = mustCreateProject(token, "Bad Status Project");

        MvcResult r = doPost("/projects/" + projectId + "/tasks",
                Map.of("title", "T", "status", "backlog"), token);
        assertThat(status(r)).isEqualTo(400);
        Map<String, Object> fields = objectMapper.convertValue(body(r).get("fields"),
                new com.fasterxml.jackson.core.type.TypeReference<>() {});
        assertThat(fields).containsKey("status");
    }

    @Test
    void create_task_invalid_priority_returns_400() throws Exception {
        String token = mustRegister("Ray3", uniqueEmail("taskbadprio"), "password123");
        String projectId = mustCreateProject(token, "Bad Priority Project");

        MvcResult r = doPost("/projects/" + projectId + "/tasks",
                Map.of("title", "T", "priority", "critical"), token);
        assertThat(status(r)).isEqualTo(400);
        Map<String, Object> fields = objectMapper.convertValue(body(r).get("fields"),
                new com.fasterxml.jackson.core.type.TypeReference<>() {});
        assertThat(fields).containsKey("priority");
    }

    @Test
    void filter_tasks_by_status() throws Exception {
        String token = mustRegister("Sam", uniqueEmail("taskfilter"), "password123");
        String projectId = mustCreateProject(token, "Filter Project");
        mustCreateTask(token, projectId, "Todo Task");
        String doneId = mustCreateTask(token, projectId, "Done Task");
        doPatch("/tasks/" + doneId, Map.of("status", "done"), token);

        List<Map<String, Object>> tasks = bodyList(
                doGet("/projects/" + projectId + "/tasks?status=todo", token));
        tasks.forEach(t -> assertThat(t.get("status")).isEqualTo("todo"));
    }

    @Test
    void filter_tasks_by_unassigned() throws Exception {
        String token = mustRegister("Tara", uniqueEmail("unassigned"), "password123");
        String projectId = mustCreateProject(token, "Unassigned Project");
        mustCreateTask(token, projectId, "No Assignee");

        List<Map<String, Object>> tasks = bodyList(
                doGet("/projects/" + projectId + "/tasks?assignee=unassigned", token));
        tasks.forEach(t -> assertThat(t.get("assignee_id")).isNull());
    }

    @Test
    void update_task_fields() throws Exception {
        String token = mustRegister("Uma", uniqueEmail("taskupd"), "password123");
        String projectId = mustCreateProject(token, "Update Project");
        String taskId = mustCreateTask(token, projectId, "Original");

        MvcResult r = doPatch("/tasks/" + taskId,
                Map.of("title", "Updated", "status", "in_progress", "priority", "high"), token);
        assertThat(status(r)).isEqualTo(200);
        Map<String, Object> b = body(r);
        assertThat(b.get("title")).isEqualTo("Updated");
        assertThat(b.get("status")).isEqualTo("in_progress");
    }

    @Test
    void update_task_invalid_status_returns_400() throws Exception {
        String token = mustRegister("Vic2", uniqueEmail("taskbadstpatch"), "password123");
        String projectId = mustCreateProject(token, "Bad Status Patch");
        String taskId = mustCreateTask(token, projectId, "Task");

        assertThat(status(doPatch("/tasks/" + taskId, Map.of("status", "backlog"), token)))
                .isEqualTo(400);
    }

    @Test
    void update_task_set_due_date() throws Exception {
        String token = mustRegister("Wes", uniqueEmail("taskdate"), "password123");
        String projectId = mustCreateProject(token, "Due Date Project");
        String taskId = mustCreateTask(token, projectId, "Dated Task");

        MvcResult r = doPatch("/tasks/" + taskId,
                Map.of("due_date", LocalDate.now().plusDays(7).toString()), token);
        assertThat(status(r)).isEqualTo(200);
        assertThat(body(r).get("due_date")).isNotNull();
    }

    @Test
    void non_member_cannot_list_tasks() throws Exception {
        String ownerToken = mustRegister("Yara", uniqueEmail("taskowner"), "password123");
        String outsiderToken = mustRegister("Zack", uniqueEmail("taskoutsider"), "password123");
        String projectId = mustCreateProject(ownerToken, "Private Tasks");

        assertThat(status(doGet("/projects/" + projectId + "/tasks", outsiderToken)))
                .isEqualTo(403);
    }

    @Test
    void delete_task_as_admin_returns_204() throws Exception {
        String token = mustRegister("AdminDel", uniqueEmail("admindel"), "password123");
        String projectId = mustCreateProject(token, "Delete Tasks Project");
        String taskId = mustCreateTask(token, projectId, "Temporary Task");

        assertThat(status(doDelete("/tasks/" + taskId, token))).isEqualTo(204);

        List<Map<String, Object>> tasks = bodyList(doGet("/projects/" + projectId + "/tasks", token));
        assertThat(tasks.stream().anyMatch(t -> taskId.equals(t.get("id")))).isFalse();
    }

    @Test
    void delete_task_as_member_returns_403() throws Exception {
        String adminToken = mustRegister("AdminKeep", uniqueEmail("admkeep"), "password123");
        String memberEmail = uniqueEmail("memkeep");
        String memberToken = mustRegister("MemKeep", memberEmail, "password123");
        String projectId = mustCreateProject(adminToken, "Member Delete Project");
        String taskId = mustCreateTask(adminToken, projectId, "Protected Task");

        String memberId = getUserId(memberToken, memberEmail, "password123");
        doPost("/projects/" + projectId + "/members",
                Map.of("user_id", memberId, "role", "member"), adminToken);

        assertThat(status(doDelete("/tasks/" + taskId, memberToken))).isEqualTo(403);
    }

    @Test
    void update_nonexistent_task_returns_404() throws Exception {
        String token = mustRegister("Ghost", uniqueEmail("ghost"), "password123");
        assertThat(status(doPatch("/tasks/00000000-0000-0000-0000-000000000099",
                Map.of("status", "done"), token))).isEqualTo(404);
    }
}

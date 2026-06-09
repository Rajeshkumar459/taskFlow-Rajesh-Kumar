package com.taskflow;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;

import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
public abstract class AbstractIntegrationTest {

    // When USE_EXTERNAL_DB=true (docker-compose), use the postgres service from .env.
    // When running locally (mvn test), Testcontainers starts its own PostgreSQL.
    private static final boolean USE_EXTERNAL_DB =
            "true".equalsIgnoreCase(System.getenv("USE_EXTERNAL_DB"));

    @SuppressWarnings("resource")
    private static final PostgreSQLContainer<?> postgres;

    static {
        if (USE_EXTERNAL_DB) {
            postgres = null;
        } else {
            postgres = new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("taskflow_test")
                    .withUsername("taskflow")
                    .withPassword("taskflow");
            postgres.start();
        }
    }

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        if (!USE_EXTERNAL_DB) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl);
            registry.add("spring.datasource.username", postgres::getUsername);
            registry.add("spring.datasource.password", postgres::getPassword);
            registry.add("app.jwt-secret", () -> "test-secret-key-must-be-32-chars!!");
        }
    }

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected ObjectMapper objectMapper;

    private static final AtomicLong emailCounter = new AtomicLong(System.currentTimeMillis());

    protected String uniqueEmail(String prefix) {
        return prefix + "+" + emailCounter.incrementAndGet() + "@test.example.com";
    }

    // ── HTTP helpers ──────────────────────────────────────────────────────────

    protected MvcResult doPost(String path, Object body, String token) throws Exception {
        var req = post(path)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body));
        if (token != null) req = req.header("Authorization", "Bearer " + token);
        return mvc.perform(req).andReturn();
    }

    protected MvcResult doGet(String path, String token) throws Exception {
        var req = get(path);
        if (token != null) req = req.header("Authorization", "Bearer " + token);
        return mvc.perform(req).andReturn();
    }

    protected MvcResult doPatch(String path, Object body, String token) throws Exception {
        var req = patch(path)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body));
        if (token != null) req = req.header("Authorization", "Bearer " + token);
        return mvc.perform(req).andReturn();
    }

    protected MvcResult doDelete(String path, String token) throws Exception {
        var req = delete(path);
        if (token != null) req = req.header("Authorization", "Bearer " + token);
        return mvc.perform(req).andReturn();
    }

    // ── Body parsers ──────────────────────────────────────────────────────────

    protected Map<String, Object> body(MvcResult result) throws Exception {
        return objectMapper.readValue(
                result.getResponse().getContentAsString(),
                new TypeReference<>() {});
    }

    protected List<Map<String, Object>> bodyList(MvcResult result) throws Exception {
        return objectMapper.readValue(
                result.getResponse().getContentAsString(),
                new TypeReference<>() {});
    }

    protected int status(MvcResult result) {
        return result.getResponse().getStatus();
    }

    // ── Test-data helpers ─────────────────────────────────────────────────────

    protected String mustRegister(String name, String email, String password) throws Exception {
        MvcResult result = doPost("/auth/register",
                Map.of("name", name, "email", email, "password", password), null);
        if (result.getResponse().getStatus() != 201)
            throw new RuntimeException("register failed: " + result.getResponse().getContentAsString());
        return (String) body(result).get("token");
    }

    protected String mustLogin(String email, String password) throws Exception {
        MvcResult result = doPost("/auth/login",
                Map.of("email", email, "password", password), null);
        if (result.getResponse().getStatus() != 200)
            throw new RuntimeException("login failed: " + result.getResponse().getContentAsString());
        return (String) body(result).get("token");
    }

    protected String mustCreateProject(String token, String name) throws Exception {
        MvcResult result = doPost("/projects", Map.of("name", name), token);
        if (result.getResponse().getStatus() != 201)
            throw new RuntimeException("create project failed: " + result.getResponse().getContentAsString());
        return (String) body(result).get("id");
    }

    protected String mustCreateTask(String token, String projectId, String title) throws Exception {
        MvcResult result = doPost("/projects/" + projectId + "/tasks", Map.of("title", title), token);
        if (result.getResponse().getStatus() != 201)
            throw new RuntimeException("create task failed: " + result.getResponse().getContentAsString());
        return (String) body(result).get("id");
    }

    protected String getUserId(String token, String email, String password) throws Exception {
        MvcResult result = doPost("/auth/login", Map.of("email", email, "password", password), null);
        Map<String, Object> user = objectMapper.convertValue(body(result).get("user"), new TypeReference<>() {});
        return (String) user.get("id");
    }
}

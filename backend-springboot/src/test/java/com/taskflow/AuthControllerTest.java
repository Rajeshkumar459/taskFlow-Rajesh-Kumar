package com.taskflow;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AuthControllerTest extends AbstractIntegrationTest {

    @Test
    void health_returns_ok() throws Exception {
        MvcResult r = doGet("/health", null);
        assertThat(status(r)).isEqualTo(200);
        assertThat(body(r).get("status")).isEqualTo("ok");
    }

    @Test
    void register_success_returns_token_and_user() throws Exception {
        String email = uniqueEmail("register");
        MvcResult r = doPost("/auth/register",
                Map.of("name", "Alice", "email", email, "password", "password123"), null);

        assertThat(status(r)).isEqualTo(201);
        Map<String, Object> b = body(r);
        assertThat(b.get("token")).isNotNull();

        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) b.get("user");
        assertThat(user.get("name")).isEqualTo("Alice");
        assertThat(user.get("email")).isEqualTo(email);
        assertThat(user).doesNotContainKey("password");
    }

    @Test
    void register_duplicate_email_returns_400_with_field_error() throws Exception {
        String email = uniqueEmail("dup");
        mustRegister("First", email, "password123");

        MvcResult r = doPost("/auth/register",
                Map.of("name", "Second", "email", email, "password", "password123"), null);

        assertThat(status(r)).isEqualTo(400);
        @SuppressWarnings("unchecked")
        Map<String, Object> fields = (Map<String, Object>) body(r).get("fields");
        assertThat(fields).containsKey("email");
    }

    @Test
    void register_missing_name_returns_400() throws Exception {
        MvcResult r = doPost("/auth/register",
                Map.of("email", "x@example.com", "password", "password123"), null);
        assertThat(status(r)).isEqualTo(400);
        @SuppressWarnings("unchecked")
        Map<String, Object> fields = (Map<String, Object>) body(r).get("fields");
        assertThat(fields).containsKey("name");
    }

    @Test
    void register_missing_email_returns_400() throws Exception {
        MvcResult r = doPost("/auth/register",
                Map.of("name", "Alice", "password", "password123"), null);
        assertThat(status(r)).isEqualTo(400);
        @SuppressWarnings("unchecked")
        Map<String, Object> fields = (Map<String, Object>) body(r).get("fields");
        assertThat(fields).containsKey("email");
    }

    @Test
    void register_invalid_email_format_returns_400() throws Exception {
        MvcResult r = doPost("/auth/register",
                Map.of("name", "Alice", "email", "not-an-email", "password", "password123"), null);
        assertThat(status(r)).isEqualTo(400);
        @SuppressWarnings("unchecked")
        Map<String, Object> fields = (Map<String, Object>) body(r).get("fields");
        assertThat(fields).containsKey("email");
    }

    @Test
    void register_short_password_returns_400() throws Exception {
        MvcResult r = doPost("/auth/register",
                Map.of("name", "Alice", "email", uniqueEmail("short"), "password", "short"), null);
        assertThat(status(r)).isEqualTo(400);
        @SuppressWarnings("unchecked")
        Map<String, Object> fields = (Map<String, Object>) body(r).get("fields");
        assertThat(fields).containsKey("password");
    }

    @Test
    void login_success_returns_token() throws Exception {
        String email = uniqueEmail("login");
        mustRegister("Bob", email, "password123");

        MvcResult r = doPost("/auth/login",
                Map.of("email", email, "password", "password123"), null);

        assertThat(status(r)).isEqualTo(200);
        Map<String, Object> b = body(r);
        assertThat(b.get("token")).isNotNull().asString().isNotBlank();
        @SuppressWarnings("unchecked")
        Map<String, Object> user = (Map<String, Object>) b.get("user");
        assertThat(user.get("email")).isEqualTo(email);
    }

    @Test
    void login_wrong_password_returns_401() throws Exception {
        String email = uniqueEmail("wrongpw");
        mustRegister("Carol", email, "correctPass123");

        MvcResult r = doPost("/auth/login",
                Map.of("email", email, "password", "wrongpassword"), null);

        assertThat(status(r)).isEqualTo(401);
    }

    @Test
    void login_nonexistent_user_returns_401() throws Exception {
        MvcResult r = doPost("/auth/login",
                Map.of("email", "nobody@example.com", "password", "whatever123"), null);
        assertThat(status(r)).isEqualTo(401);
    }

    @Test
    void login_missing_fields_returns_400() throws Exception {
        MvcResult r = doPost("/auth/login", Map.of("password", "password123"), null);
        assertThat(status(r)).isEqualTo(400);
        @SuppressWarnings("unchecked")
        Map<String, Object> fields = (Map<String, Object>) body(r).get("fields");
        assertThat(fields).containsKey("email");
    }

    @Test
    void protected_route_without_token_returns_401() throws Exception {
        MvcResult r = doGet("/projects", null);
        assertThat(status(r)).isEqualTo(401);
    }
}

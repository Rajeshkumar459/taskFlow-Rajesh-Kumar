package com.taskflow.controller;

import com.taskflow.dto.UserResponse;
import com.taskflow.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;

    @GetMapping("/users")
    public List<UserResponse> listUsers(@AuthenticationPrincipal UUID userId) {
        return userRepository.findAll().stream()
                .map(UserResponse::from)
                .toList();
    }
}

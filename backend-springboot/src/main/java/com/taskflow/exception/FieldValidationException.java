package com.taskflow.exception;

import java.util.Map;

public class FieldValidationException extends RuntimeException {

    private final Map<String, String> fields;

    public FieldValidationException(String field, String message) {
        super("validation failed");
        this.fields = Map.of(field, message);
    }

    public Map<String, String> getFields() {
        return fields;
    }
}

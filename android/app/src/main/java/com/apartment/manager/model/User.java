package com.apartment.manager.model;

public class User {
    private String id;
    private String full_name;
    private String email;
    private String role;

    public String getId() { return id; }
    public String getFullName() { return full_name; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public boolean isStaff() {
        return "super_admin".equals(role) || "property_manager".equals(role) || "staff".equals(role);
    }
}

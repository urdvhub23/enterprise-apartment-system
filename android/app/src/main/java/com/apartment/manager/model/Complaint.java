package com.apartment.manager.model;

import java.util.List;

public class Complaint {
    private String _id;
    private String title;
    private String description;
    private String category;
    private String priority;
    private String status;

    public String getId() { return _id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getCategory() { return category; }
    public String getPriority() { return priority; }
    public String getStatus() { return status; }

    public static class ListResponseWrapper {
        public List<Complaint> complaints;
    }
}

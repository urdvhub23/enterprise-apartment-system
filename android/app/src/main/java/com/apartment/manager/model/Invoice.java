package com.apartment.manager.model;

import java.util.List;

public class Invoice {
    private String id;
    private String invoice_number;
    private String due_date;
    private double total_amount;
    private String status;

    public String getId() { return id; }
    public String getInvoiceNumber() { return invoice_number; }
    public String getDueDate() { return due_date; }
    public double getTotalAmount() { return total_amount; }
    public String getStatus() { return status; }
}

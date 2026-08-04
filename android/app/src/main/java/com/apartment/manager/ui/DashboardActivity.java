package com.apartment.manager.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.apartment.manager.R;
import com.apartment.manager.api.SessionManager;

public class DashboardActivity extends AppCompatActivity {

    private SessionManager session;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_dashboard);

        session = new SessionManager(this);

        TextView welcome = findViewById(R.id.welcomeText);
        welcome.setText("Welcome, " + session.getFullName());

        findViewById(R.id.complaintsButton).setOnClickListener(v ->
                startActivity(new Intent(this, ComplaintsActivity.class)));

        findViewById(R.id.billingButton).setOnClickListener(v ->
                startActivity(new Intent(this, BillingActivity.class)));

        findViewById(R.id.logoutButton).setOnClickListener(v -> {
            session.clear();
            startActivity(new Intent(this, LoginActivity.class));
            finish();
        });
    }
}

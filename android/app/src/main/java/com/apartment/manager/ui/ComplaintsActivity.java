package com.apartment.manager.ui;

import android.os.Bundle;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.apartment.manager.R;
import com.apartment.manager.api.ApiClient;
import com.apartment.manager.api.SessionManager;
import com.apartment.manager.model.Complaint;
import com.apartment.manager.model.ComplaintListResponse;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ComplaintsActivity extends AppCompatActivity {

    private SimpleRowAdapter adapter;
    private SessionManager session;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_list);
        setTitle("Maintenance requests");

        session = new SessionManager(this);

        RecyclerView recyclerView = findViewById(R.id.recyclerView);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        adapter = new SimpleRowAdapter();
        recyclerView.setAdapter(adapter);

        SwipeRefreshLayout swipeRefresh = findViewById(R.id.swipeRefresh);
        swipeRefresh.setOnRefreshListener(() -> { loadComplaints(); swipeRefresh.setRefreshing(false); });

        loadComplaints();
    }

    private void loadComplaints() {
        ApiClient.getService().getComplaints(session.getBearerToken())
                .enqueue(new Callback<ComplaintListResponse>() {
                    @Override
                    public void onResponse(Call<ComplaintListResponse> call, Response<ComplaintListResponse> response) {
                        if (!response.isSuccessful() || response.body() == null) {
                            Toast.makeText(ComplaintsActivity.this, "Could not load requests", Toast.LENGTH_SHORT).show();
                            return;
                        }
                        List<Complaint> complaints = response.body().getComplaints();
                        List<SimpleRowAdapter.Row> rows = new ArrayList<>();
                        for (Complaint c : complaints) {
                            rows.add(new SimpleRowAdapter.Row(
                                    c.getTitle(),
                                    c.getCategory() + " · " + c.getPriority() + " priority",
                                    c.getStatus().toUpperCase()
                            ));
                        }
                        adapter.submitList(rows);
                    }

                    @Override
                    public void onFailure(Call<ComplaintListResponse> call, Throwable t) {
                        Toast.makeText(ComplaintsActivity.this, "Network error", Toast.LENGTH_SHORT).show();
                    }
                });
    }
}

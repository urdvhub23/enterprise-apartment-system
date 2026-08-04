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
import com.apartment.manager.model.Invoice;
import com.apartment.manager.model.InvoiceListResponse;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class BillingActivity extends AppCompatActivity {

    private SimpleRowAdapter adapter;
    private SessionManager session;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_list);
        setTitle("Rent & invoices");

        session = new SessionManager(this);

        RecyclerView recyclerView = findViewById(R.id.recyclerView);
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        adapter = new SimpleRowAdapter();
        recyclerView.setAdapter(adapter);

        SwipeRefreshLayout swipeRefresh = findViewById(R.id.swipeRefresh);
        swipeRefresh.setOnRefreshListener(() -> { loadInvoices(); swipeRefresh.setRefreshing(false); });

        loadInvoices();
    }

    private void loadInvoices() {
        ApiClient.getService().getInvoices(session.getBearerToken())
                .enqueue(new Callback<InvoiceListResponse>() {
                    @Override
                    public void onResponse(Call<InvoiceListResponse> call, Response<InvoiceListResponse> response) {
                        if (!response.isSuccessful() || response.body() == null) {
                            Toast.makeText(BillingActivity.this, "Could not load invoices", Toast.LENGTH_SHORT).show();
                            return;
                        }
                        List<Invoice> invoices = response.body().getInvoices();
                        List<SimpleRowAdapter.Row> rows = new ArrayList<>();
                        for (Invoice inv : invoices) {
                            rows.add(new SimpleRowAdapter.Row(
                                    inv.getInvoiceNumber(),
                                    "$" + inv.getTotalAmount() + " · due " + inv.getDueDate(),
                                    inv.getStatus().toUpperCase()
                            ));
                        }
                        adapter.submitList(rows);
                    }

                    @Override
                    public void onFailure(Call<InvoiceListResponse> call, Throwable t) {
                        Toast.makeText(BillingActivity.this, "Network error", Toast.LENGTH_SHORT).show();
                    }
                });
    }
}

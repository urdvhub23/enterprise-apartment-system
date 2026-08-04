package com.apartment.manager.ui;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.apartment.manager.R;

import java.util.ArrayList;
import java.util.List;

/**
 * Minimal adapter shared by the Complaints and Billing screens so the
 * scaffold stays small. Swap in dedicated adapters as each screen grows.
 */
public class SimpleRowAdapter extends RecyclerView.Adapter<SimpleRowAdapter.RowViewHolder> {

    public static class Row {
        public final String title;
        public final String subtitle;
        public final String status;

        public Row(String title, String subtitle, String status) {
            this.title = title;
            this.subtitle = subtitle;
            this.status = status;
        }
    }

    private final List<Row> rows = new ArrayList<>();

    public void submitList(List<Row> newRows) {
        rows.clear();
        rows.addAll(newRows);
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public RowViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext()).inflate(R.layout.row_item, parent, false);
        return new RowViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull RowViewHolder holder, int position) {
        Row row = rows.get(position);
        holder.title.setText(row.title);
        holder.subtitle.setText(row.subtitle);
        holder.status.setText(row.status);
    }

    @Override
    public int getItemCount() { return rows.size(); }

    static class RowViewHolder extends RecyclerView.ViewHolder {
        final TextView title;
        final TextView subtitle;
        final TextView status;

        RowViewHolder(@NonNull View itemView) {
            super(itemView);
            title = itemView.findViewById(R.id.rowTitle);
            subtitle = itemView.findViewById(R.id.rowSubtitle);
            status = itemView.findViewById(R.id.rowStatus);
        }
    }
}

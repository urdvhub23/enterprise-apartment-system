package com.apartment.manager.api;

import com.apartment.manager.model.AuthResponse;
import com.apartment.manager.model.LoginRequest;
import com.apartment.manager.model.ComplaintListResponse;
import com.apartment.manager.model.InvoiceListResponse;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.POST;

/**
 * Mirrors the Express API gateway routes used by the web app
 * (see backend/server.js). Keeping the same route shapes means the
 * Android client, the React web app, and the staff PWA all talk to
 * one backend with no duplicated business logic.
 */
public interface ApiService {

    @POST("auth/login")
    Call<AuthResponse> login(@Body LoginRequest request);

    @GET("complaints")
    Call<ComplaintListResponse> getComplaints(@Header("Authorization") String bearerToken);

    @GET("billing/invoices")
    Call<InvoiceListResponse> getInvoices(@Header("Authorization") String bearerToken);
}

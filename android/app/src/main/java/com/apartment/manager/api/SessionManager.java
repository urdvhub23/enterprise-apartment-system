package com.apartment.manager.api;

import android.content.Context;
import android.content.SharedPreferences;

public class SessionManager {
    private static final String PREFS = "apartment_manager_session";
    private static final String KEY_TOKEN = "token";
    private static final String KEY_ROLE = "role";
    private static final String KEY_NAME = "full_name";

    private final SharedPreferences prefs;

    public SessionManager(Context context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public void save(String token, String role, String fullName) {
        prefs.edit()
                .putString(KEY_TOKEN, token)
                .putString(KEY_ROLE, role)
                .putString(KEY_NAME, fullName)
                .apply();
    }

    public String getToken() { return prefs.getString(KEY_TOKEN, null); }
    public String getRole() { return prefs.getString(KEY_ROLE, null); }
    public String getFullName() { return prefs.getString(KEY_NAME, null); }
    public String getBearerToken() { return "Bearer " + getToken(); }
    public boolean isLoggedIn() { return getToken() != null; }

    public void clear() { prefs.edit().clear().apply(); }
}

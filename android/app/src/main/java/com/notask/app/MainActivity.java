package com.notask.app;

import com.getcapacitor.BridgeActivity;
import android.os.Handler;
import android.os.Looper;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Add a fallback to hide splash screen after 5 seconds
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                try {
                    // Hide splash screen if it's still showing
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().post(new Runnable() {
                            @Override
                            public void run() {
                                getBridge().getWebView().evaluateJavascript(
                                    "if (window.Capacitor && window.Capacitor.Plugins.SplashScreen) { window.Capacitor.Plugins.SplashScreen.hide(); }",
                                    null
                                );
                            }
                        });
                    }
                } catch (Exception e) {
                    // Ignore errors
                }
            }
        }, 5000);

        // Request exact alarm permission on Android 12+ (S and above). Without this
        // permission, scheduled local notifications may not fire when the device is
        // idle or the app is in the background. See
        // https://developer.android.com/training/alarms/exact
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            android.app.AlarmManager alarmManager = (android.app.AlarmManager) getSystemService(android.content.Context.ALARM_SERVICE);
            if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                android.content.Intent intent = new android.content.Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                // It's safe to start this intent without expecting a result. The system
                // will display a permission screen to the user.
                startActivity(intent);
            }
        }
    }
}

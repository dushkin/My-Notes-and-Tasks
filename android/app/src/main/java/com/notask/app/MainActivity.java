package com.notask.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

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

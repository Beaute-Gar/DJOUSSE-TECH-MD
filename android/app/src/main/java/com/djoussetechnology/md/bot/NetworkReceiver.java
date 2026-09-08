package com.djoussetechnology.md.bot;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.util.Log;

public class NetworkReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.d("NetworkReceiver", "Boot completed, starting BotService");
            startService(context, "Démarrage automatique après boot");
        } else {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
            boolean isConnected = activeNetwork != null && activeNetwork.isConnectedOrConnecting();

            if (isConnected) {
                Log.d("NetworkReceiver", "Internet connecté, vérification du BotService");
                startService(context, "Reconnexion automatique (Internet rétabli)");
            }
        }
    }

    private void startService(Context context, String reason) {
        Intent serviceIntent = new Intent(context, BotService.class);
        serviceIntent.putExtra("inputExtra", reason);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}

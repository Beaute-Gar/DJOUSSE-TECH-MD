package com.djoussetechnology.md;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.djoussetechnology.md.bot.BotService;

public class MainActivity extends AppCompatActivity {
    private EditText phoneInput;
    private Button btnGenerate;
    private TextView statusText;
    private TextView pairingCodeText;
    private TextView logText;

    private BroadcastReceiver botReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("BOT_STATUS_UPDATE".equals(intent.getAction())) {
                String status = intent.getStringExtra("status");
                String code = intent.getStringExtra("pairingCode");
                String log = intent.getStringExtra("log");

                if (status != null) statusText.setText("Statut: " + status);
                if (code != null) {
                    pairingCodeText.setText(code);
                    pairingCodeText.setVisibility(View.VISIBLE);
                }
                if (log != null) logText.append(log + "\n");
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        phoneInput = findViewById(R.id.phoneInput);
        btnGenerate = findViewById(R.id.btnGenerate);
        statusText = findViewById(R.id.statusText);
        pairingCodeText = findViewById(R.id.pairingCodeText);
        logText = findViewById(R.id.logText);

        btnGenerate.setOnClickListener(v -> {
            String phone = phoneInput.getText().toString().trim();
            if (phone.isEmpty()) {
                logText.append("[UI] Veuillez entrer un numéro\n");
                return;
            }
            startBotService(phone);
        });

        registerReceiver(botReceiver, new IntentFilter("BOT_STATUS_UPDATE"));
    }

    private void startBotService(String phone) {
        Intent serviceIntent = new Intent(this, BotService.class);
        serviceIntent.putExtra("inputExtra", "Démarrage par l'utilisateur");
        serviceIntent.putExtra("phoneNumber", phone);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
        logText.append("[UI] Tentative de connexion pour " + phone + "\n");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        unregisterReceiver(botReceiver);
    }
}

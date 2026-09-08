package com.djoussetechnology.md.bot;

import android.content.Context;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class NodeRunner {
    private static final String TAG = "NodeRunner";
    private Context context;
    private boolean isRunning = false;

    // Manual JNI Bridge
    static {
        System.loadLibrary("node");
        System.loadLibrary("native-lib");
    }

    public native int startNodeWithArguments(String[] args);

    public NodeRunner(Context context) {
        this.context = context;
    }

    public boolean isRunning() {
        return isRunning;
    }

    public void startNode() {
        if (isRunning) return;

        new Thread(() -> {
            try {
                isRunning = true;
                File nodeDir = new File(context.getFilesDir(), "nodejs-project");
                
                // Logique d'extraction initiale
                if (!nodeDir.exists()) {
                    Log.d(TAG, "Premier lancement : extraction du projet...");
                    extractZip(context, "nodejs-project.zip", context.getFilesDir());
                }

                Log.d(TAG, "Démarrage du moteur Node.js...");
                String scriptPath = new File(nodeDir, "index.cjs").getAbsolutePath();
                
                // Lancement manuel du runtime Node.js
                int result = startNodeWithArguments(new String[]{"node", scriptPath});
                Log.d(TAG, "Le moteur Node.js s'est arrêté avec le code : " + result);
                
            } catch (Exception e) {
                Log.e(TAG, "Erreur fatale Node.js", e);
            } finally {
                isRunning = false;
            }
        }).start();
    }

    private void extractZip(Context context, String zipFile, File targetDir) throws Exception {
        InputStream is = context.getAssets().open(zipFile);
        ZipInputStream zis = new ZipInputStream(is);
        ZipEntry ze;
        byte[] buffer = new byte[1024 * 16];

        while ((ze = zis.getNextEntry()) != null) {
            File file = new File(targetDir, ze.getName());
            if (ze.isDirectory()) {
                file.mkdirs();
            } else {
                File parent = file.getParentFile();
                if (parent != null) parent.mkdirs();
                try (FileOutputStream fos = new FileOutputStream(file)) {
                    int len;
                    while ((len = zis.read(buffer)) > 0) {
                        fos.write(buffer, 0, len);
                    }
                }
            }
            zis.closeEntry();
        }
        zis.close();
    }

    public void stopNode() {
        // Le runtime ne peut généralement pas être arrêté proprement sans tuer le processus
        isRunning = false;
    }
}

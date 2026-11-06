package com.mondiro.mcalc;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Tải APK bản mới từ GitHub Releases rồi mở trình cài đặt của Android. */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        JSObject r = new JSObject();
        try {
            PackageInfo p = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            r.put("version", p.versionName);
        } catch (Exception e) {
            r.put("version", "0.0.0");
        }
        call.resolve(r);
    }

    @PluginMethod
    public void install(PluginCall call) {
        String url = call.getString("url");
        if (url == null) { call.reject("Thiếu đường dẫn"); return; }
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(s);
            call.reject("NEED_PERMISSION");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "update");
                dir.mkdirs();
                File apk = new File(dir, "m-calc.apk");
                HttpURLConnection c = open(url);
                long total = c.getContentLengthLong(), done = 0, lastPct = -1;
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            long pct = done * 100 / total;
                            if (pct != lastPct) {
                                lastPct = pct;
                                JSObject ev = new JSObject();
                                ev.put("percent", pct);
                                notifyListeners("progress", ev);
                            }
                        }
                    }
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
            } catch (Exception e) {
                call.reject("Tải bản cập nhật thất bại: " + e.getMessage());
            }
        }).start();
    }

    /** Mở kết nối, tự đi theo redirect (GitHub chuyển hướng sang máy chủ tải file). */
    private HttpURLConnection open(String u) throws Exception {
        for (int i = 0; i < 6; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("Accept", "application/octet-stream");
            c.setRequestProperty("User-Agent", "M-Calc-Updater");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) { u = c.getHeaderField("Location"); c.disconnect(); continue; }
            if (code != 200) throw new Exception("HTTP " + code);
            return c;
        }
        throw new Exception("Quá nhiều chuyển hướng");
    }
}

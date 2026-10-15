package com.squashhub.coach;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.os.Environment;
import android.content.Intent;
import android.content.ContentValues;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import android.graphics.Color;
import android.util.Base64;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://alinavasileva-cco.github.io/squash/";
    private static final int PICK_FILE = 321;
    private WebView webView;
    private android.webkit.ValueCallback<Uri[]> fileCallback;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(23, 25, 21));
        getWindow().setNavigationBarColor(Color.rgb(23, 25, 21));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(247, 247, 243));
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        webView.addJavascriptInterface(new NativeDownloads(), "SquashNative");
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w,
                android.webkit.ValueCallback<Uri[]> callback,
                FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(intent, PICK_FILE);
                    return true;
                } catch (Exception e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "Не удалось открыть файлы", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("alinavasileva-cco.github.io".equalsIgnoreCase(u.getHost())
                    && u.getPath() != null && u.getPath().startsWith("/squash/")) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Не удалось открыть ссылку", Toast.LENGTH_SHORT).show();
                }
                return true;
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                String hook = "(function(){if(window.__squashNativeDownload)return;"
                    + "window.__squashNativeDownload=true;"
                    + "document.addEventListener('click',function(e){"
                    + "var a=e.target.closest('a[download]');"
                    + "if(!a||!a.href.startsWith('blob:'))return;"
                    + "e.preventDefault();"
                    + "fetch(a.href).then(r=>r.blob()).then(b=>{var f=new FileReader();"
                    + "f.onloadend=()=>SquashNative.saveBackup(f.result);"
                    + "f.readAsDataURL(b)}).catch(()=>{});},true);})();";
                view.evaluateJavascript(hook, null);
            }
        });
        webView.setDownloadListener((url, agent, disposition, mime, length) -> {
            if (url.startsWith("blob:")) {
                String js = "(function(){fetch(" + org.json.JSONObject.quote(url)
                    + ").then(r=>r.blob()).then(b=>{var f=new FileReader();"
                    + "f.onloadend=()=>SquashNative.saveBackup(f.result);"
                    + "f.readAsDataURL(b)}).catch(()=>{});})();";
                webView.evaluateJavascript(js, null);
            } else if (url.startsWith("https://")) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
                catch (Exception ignored) { }
            }
        });
        webView.loadUrl(APP_URL);
    }

    private class NativeDownloads {
        @JavascriptInterface
        public void saveBackup(String dataUrl) {
            if (dataUrl == null || !dataUrl.startsWith("data:application/json;base64,")
                && !dataUrl.startsWith("data:application/octet-stream;base64,")) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                    "Не удалось сохранить копию", Toast.LENGTH_SHORT).show());
                return;
            }
            try {
                byte[] json = Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT);
                String name = "squash-hub-backup-" + new SimpleDateFormat(
                    "yyyy-MM-dd-HHmm", Locale.US).format(new Date()) + ".json";
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
                    cv.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                    cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri dest = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (dest == null) throw new Exception("No file URI");
                    try (OutputStream output = getContentResolver().openOutputStream(dest)) {
                        if (output == null) throw new Exception("No stream");
                        output.write(json);
                    }
                } else {
                    java.io.File directory = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (directory == null) throw new Exception("No download dir");
                    java.io.File out = new java.io.File(directory, name);
                    try (java.io.FileOutputStream output = new java.io.FileOutputStream(out)) {
                        output.write(json);
                    }
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                    "Копия сохранена: " + name, Toast.LENGTH_LONG).show());
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                    "Не удалось скачать резервную копию", Toast.LENGTH_LONG).show());
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_FILE && fileCallback != null) {
            Uri[] uris = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                uris = new Uri[]{ data.getData() };
            }
            fileCallback.onReceiveValue(uris);
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}

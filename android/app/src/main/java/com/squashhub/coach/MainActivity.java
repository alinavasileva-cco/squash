package com.squashhub.coach;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.ContentValues;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
  private static final String SITE = "https://alinavasileva-cco.github.io/squash/";
  private WebView web;
  private android.webkit.ValueCallback<Uri[]> fileCallback;
  private static final int PICK = 321;

  @SuppressLint({"SetJavaScriptEnabled","JavascriptInterface"})
  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().setStatusBarColor(Color.rgb(23,25,21));
    getWindow().setNavigationBarColor(Color.rgb(23,25,21));
    web = new WebView(this);
    web.setBackgroundColor(Color.rgb(247,247,243));
    setContentView(web);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.addJavascriptInterface(new NativeDownloads(), "SquashNative");
    web.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onShowFileChooser(WebView w, android.webkit.ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = callback;
        try { startActivityForResult(params.createIntent(),PICK); return true; }
        catch(Exception e) { fileCallback = null; Toast.makeText(MainActivity.this,"Не удалось открыть файлы",Toast.LENGTH_SHORT).show(); return false; }
      }
    });
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
        Uri url=request.getUrl();
        if ("alinavasileva-cco.github.io".equalsIgnoreCase(url.getHost()) && url.getPath()!=null && url.getPath().startsWith("/squash/")) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW,url)); }
        catch(Exception e) { Toast.makeText(MainActivity.this,"Не удалось открыть ссылку",Toast.LENGTH_SHORT).show(); }
        return true;
      }
      @Override public void onPageFinished(WebView v,String url) {
        String js="(function(){if(window.__squashApk)return;window.__squashApk=true;"
          +"document.addEventListener('click',function(e){var a=e.target.closest('a[download]');"
          +"if(!a||!a.href.startsWith('blob:'))return;e.preventDefault();"
          +"fetch(a.href).then(r=>r.blob()).then(b=>{var f=new FileReader();"
          +"f.onloadend=()=>SquashNative.saveBackup(f.result);f.readAsDataURL(b)}).catch(()=>{});},true);})();";
        v.evaluateJavascript(js,null);
      }
    });
    web.setDownloadListener((url,agent,disposition,mime,length)->{
      if(url.startsWith("blob:")){
        String js="fetch("+org.json.JSONObject.quote(url)+").then(r=>r.blob()).then(b=>{var f=new FileReader();"
          +"f.onloadend=()=>SquashNative.saveBackup(f.result);f.readAsDataURL(b)}).catch(()=>{});";
        web.evaluateJavascript(js,null);
      } else if(url.startsWith("https://")) {
        try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception ignored){}
      }
    });
    web.loadUrl(SITE);
  }
  private class NativeDownloads {
    @JavascriptInterface public void saveBackup(String dataUrl) {
      if(dataUrl==null || !dataUrl.startsWith("data:application/json;base64,") && !dataUrl.startsWith("data:application/octet-stream;base64,")) return;
      try {
        byte[] json=Base64.decode(dataUrl.substring(dataUrl.indexOf(',')+1),Base64.DEFAULT);
        String name="squash-hub-backup-"+new SimpleDateFormat("yyyy-MM-dd-HHmm",Locale.US).format(new Date())+".json";
        if(Build.VERSION.SDK_INT>=29) {
          ContentValues v=new ContentValues();
          v.put(MediaStore.Downloads.DISPLAY_NAME,name);
          v.put(MediaStore.Downloads.MIME_TYPE,"application/json");
          v.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS);
          Uri dest=getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,v);
          if(dest==null)throw new Exception("No URI");
          try(OutputStream out=getContentResolver().openOutputStream(dest)){if(out==null)throw new Exception("No stream");out.write(json);}
        } else {
          java.io.File dir=getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
          if(dir==null)throw new Exception("No download directory");
          try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(dir,name))){out.write(json);}
        }
        runOnUiThread(()->Toast.makeText(MainActivity.this,"Копия сохранена: "+name,Toast.LENGTH_LONG).show());
      } catch(Exception e) {runOnUiThread(()->Toast.makeText(MainActivity.this,"Не удалось сохранить копию",Toast.LENGTH_LONG).show());}
    }
  }
  @Override protected void onActivityResult(int req,int result,Intent data) {
    super.onActivityResult(req,result,data);
    if(req==PICK && fileCallback!=null) {
      Uri[] uris=(result==RESULT_OK && data!=null && data.getData()!=null)?new Uri[]{data.getData()}:null;
      fileCallback.onReceiveValue(uris);fileCallback=null;
    }
  }
  @Override public void onBackPressed() {
    if(web!=null && web.canGoBack())web.goBack(); else super.onBackPressed();
  }
}

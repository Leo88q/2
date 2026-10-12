// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
package game.piegeddon.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import game.piegeddon.app.web3.PiegeddonBridge
import game.piegeddon.app.web3.WalletManager

/**
 * Оболочка Piegeddon: WebView с мобильной игрой (меню, арена, награды)
 * + нативный Web3-мост (Mobile Wallet Adapter).
 *
 * Атрибуция: игровое ядро основано на Pie Noon by Google (Apache 2.0),
 * см. экран «Об игре» в веб-части и NOTICE в репозитории.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var walletManager: WalletManager

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        walletManager = WalletManager(this)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
        }
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(PiegeddonBridge(this, walletManager, webView), "PiegeddonWallet")

        webView.loadUrl("file:///android_asset/web/index.html")
    }

    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}

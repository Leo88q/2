// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
package game.piegeddon.app.web3

import android.app.Activity
import android.webkit.JavascriptInterface
import android.webkit.WebView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * JS-мост window.PiegeddonWallet:
 *   PiegeddonWallet.connect()            -> подключить кошелёк (MWA)
 *   PiegeddonWallet.onConnected(addr)    -> колбэк в JS (реализуется игрой)
 *   PiegeddonWallet.onError(message)     -> колбэк ошибки
 */
class PiegeddonBridge(
    private val activity: Activity,
    private val walletManager: WalletManager,
    private val webView: WebView,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    @JavascriptInterface
    fun connect() {
        scope.launch {
            val address = walletManager.connect()
            val js = if (address != null) {
                "window.PiegeddonWallet && window.PiegeddonWallet.onConnected && window.PiegeddonWallet.onConnected('$address');"
            } else {
                "window.PiegeddonWallet && window.PiegeddonWallet.onError && window.PiegeddonWallet.onError('cancelled');"
            }
            activity.runOnUiThread { webView.evaluateJavascript(js, null) }
        }
    }
}

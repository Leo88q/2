// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
package game.piegeddon.app.web3

import android.app.Activity
import android.net.Uri
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.RpcCluster
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Подключение кошелька через Solana Mobile Wallet Adapter (MWA).
 *
 * Поток: игрок нажимает «Забрать NFT» -> MWA authorize -> адрес base58
 * -> JS отправляет POST /api/claim { playerId, wallet } -> backend минтит cNFT.
 *
 * Примечание: сигнатуры clientlib сверяются при первом CI-прогоне
 * (см. docs/DEPLOY.md, «Known bring-up items»).
 */
class WalletManager(private val activity: Activity) {

    private val walletAdapter = MobileWalletAdapter(
        uri = Uri.parse("https://piegeddon.game"),
        iconUri = Uri.parse("favicon:///android_asset/web/img/hero.jpg"),
        name = "Piegeddon",
        rpcCluster = RpcCluster.Mainnet,
    )

    /** Возвращает base58-адрес кошелька или null, если игрок отменил. */
    suspend fun connect(): String? = withContext(Dispatchers.Main) {
        try {
            val result = walletAdapter.transact(activity) { auth ->
                auth.authorize(
                    uri = Uri.parse("https://piegeddon.game"),
                    iconUri = Uri.parse("favicon:///android_asset/web/img/hero.jpg"),
                    identityName = "Piegeddon",
                )
            }
            result.publicKey?.let { encodeBase58(it) }
        } catch (e: Exception) {
            null
        }
    }

    private fun encodeBase58(bytes: ByteArray): String {
        val alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        var value = 0
        var out = ""
        var zeros = 0
        for (b in bytes) {
            if (b.toInt() == 0 && out.isEmpty()) { zeros++; continue }
            value = (value shl 8) or (b.toInt() and 0xff)
            var s = ""
            while (value > 0) {
                s = alphabet[value % 58] + s
                value /= 58
            }
            out += s
        }
        return "1".repeat(zeros) + (out.ifEmpty { "" })
    }
}

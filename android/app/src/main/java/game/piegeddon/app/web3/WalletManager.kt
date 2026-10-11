// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
package game.piegeddon.app.web3

import android.net.Uri
import androidx.activity.ComponentActivity
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.ConnectionIdentity
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.Solana
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Подключение кошелька через Solana Mobile Wallet Adapter (clientlib-ktx 2.x).
 *
 * Поток: игрок нажимает «Забрать NFT» -> MWA authorize -> base58-адрес
 * -> JS отправляет POST /api/claim { playerId, wallet } -> backend минтит cNFT
 * (Metaplex Bubblegum, комиссию платит проект).
 *
 * API сверен с исходниками solana-mobile/mobile-wallet-adapter (clientlib-ktx):
 *   MobileWalletAdapter(ConnectionIdentity) + blockchain = Solana.Mainnet
 *   transact(sender: ActivityResultSender) { authResult -> ... }
 */
class WalletManager(private val activity: ComponentActivity) {

    private val sender = ActivityResultSender(activity)

    private val walletAdapter = MobileWalletAdapter(
        connectionIdentity = ConnectionIdentity(
            identityUri = Uri.parse(IDENTITY_URI),
            iconUri = Uri.parse(IDENTITY_ICON),
            identityName = "Piegeddon",
        ),
    ).apply {
        blockchain = Solana.Mainnet
    }

    /** Возвращает base58-адрес кошелька или null, если игрок отменил / кошелёк не найден. */
    suspend fun connect(): String? = withContext(Dispatchers.Main) {
        val result = walletAdapter.transact(sender) { authResult ->
            authResult.accounts.firstOrNull()?.publicKey
        }
        when (result) {
            is TransactionResult.Success -> result.payload?.let { encodeBase58(it) }
            is TransactionResult.Failure -> null
            is TransactionResult.NoWalletFound -> null
        }
    }

    private fun encodeBase58(bytes: ByteArray): String {
        val alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        var value = 0
        var out = StringBuilder()
        var zeros = 0
        for (b in bytes) {
            if (b.toInt() == 0 && out.isEmpty()) { zeros++; continue }
            value = (value shl 8) or (b.toInt() and 0xff)
            val s = StringBuilder()
            while (value > 0) {
                s.insert(0, alphabet[value % 58])
                value /= 58
            }
            out.append(s)
        }
        return "1".repeat(zeros) + out.toString()
    }

    companion object {
        const val IDENTITY_URI = "https://piegeddon.game"
        const val IDENTITY_ICON = "favicon:///android_asset/web/img/collection_icon.png"
    }
}

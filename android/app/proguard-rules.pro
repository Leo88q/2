# Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
# Правила ProGuard/R8 для оболочки Piegeddon.
-keep class game.piegeddon.app.web3.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.solana.mobilewalletadapter.** { *; }

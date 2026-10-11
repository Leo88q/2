// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val keystorePath: String? = System.getenv("PIEGEDDON_KEYSTORE")
val keystorePassword: String? = System.getenv("PIEGEDDON_KEYSTORE_PASSWORD")
val keyAlias: String? = System.getenv("PIEGEDDON_KEY_ALIAS")
val keyPassword: String? = System.getenv("PIEGEDDON_KEY_PASSWORD")

android {
    namespace = "game.piegeddon.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "game.piegeddon.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("string", "API_BASE_URL", "\"${System.getenv("PIEGEDDON_API_BASE") ?: "https://api.piegeddon.game"}\"")
    }

    signingConfigs {
        create("release") {
            if (keystorePath != null) {
                storeType = System.getenv("PIEGEDDON_KEYSTORE_TYPE") ?: "pkcs12"
                storeFile = file(keystorePath)
                storePassword = keystorePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
            }
        }
    }

    buildTypes {
        release {
            // Для локальных/CI-сборок без секретов подписываем debug-ключом;
            // продакшн-подпись включается переменными окружения (docs/DEPLOY.md).
            signingConfig = if (keystorePath != null) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    // Solana Mobile Wallet Adapter (Apache 2.0). API сверен с исходниками v2.2.0.
    implementation("com.solana:mobile-wallet-adapter-clientlib-ktx:2.2.0")
}

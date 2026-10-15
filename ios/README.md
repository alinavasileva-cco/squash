# Squash Hub — iPhone app (iOS 15+)

SwiftUI + WKWebView native iOS host for the same Squash Hub trainer calendar used on Android. App icon: black squash ball with two yellow dots.

The project is built on GitHub macOS runners using XcodeGen. The workflow creates an **unsigned IPA** for technical testing and signing. An unsigned IPA is **not directly installable** on an ordinary iPhone.

## Install options

1. **Free sideload**: sign the unsigned IPA with a personal Apple ID using AltStore or Sideloadly (requires a Mac/Windows computer and periodic refresh for free Apple IDs). Follow the provider's official setup instructions. Do not give Apple ID passwords to third-party websites.
2. **TestFlight**: requires access to an Apple Developer Program team, App Store Connect, a valid signing identity/profile and upload to TestFlight. The repository does not contain Apple credentials.
3. **Xcode on Mac**: open the generated Xcode project after running XcodeGen, choose personal development team, connect iPhone, and build to device.

The iOS app loads the live HTTPS site inside a native WebKit container. Student and training data remain on the device and are not synced automatically. Data in Safari, Chrome, Android APK and this iOS app have separate local storage. Keep backups before migrating or uninstalling.

Build: GitHub → Actions → "Build iPhone IPA" → latest successful run → artifacts.

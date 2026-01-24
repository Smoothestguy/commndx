# Command X - Mobile App Release Guide

## App Information

- **App Name**: Command X
- **Bundle ID**: com.commndx.app
- **Current Version**: 1.0.15
- **Minimum iOS Version**: 14.0
- **Minimum Android SDK**: 23 (Android 6.0)

---

## Prerequisites

### iOS Requirements
- Mac with macOS 13+ and Xcode 15+ installed
- Apple Developer account ($99/year) - [developer.apple.com](https://developer.apple.com)
- App Store Connect access
- Development and Distribution certificates configured

### Android Requirements
- Android Studio (latest stable version)
- Google Play Developer account ($25 one-time) - [play.google.com/console](https://play.google.com/console)
- Java Development Kit (JDK) 17+
- Keystore file for app signing

---

## Development Setup

### 1. Clone and Install

```bash
# Clone from GitHub
git clone <your-repo-url>
cd commndx

# Install dependencies
npm install

# Build the web app
npm run build

# Sync to native platforms
npx cap sync
```

### 2. Development Mode (Hot Reload)

Edit `capacitor.config.ts` and uncomment the development URL:

```typescript
server: {
  url: 'http://localhost:5173', // Uncomment for development
  // ...
}
```

Then run:
```bash
npm run dev  # Start Vite dev server
npx cap run ios  # or npx cap run android
```

---

## iOS Release Process

### Step 1: Prepare Build

```bash
# Build the production web app
npm run build

# Sync to iOS
npx cap sync ios

# Open in Xcode
npx cap open ios
```

### Step 2: Configure in Xcode

1. **Select the "App" target** in the project navigator

2. **Signing & Capabilities tab**:
   - Select your Team from the dropdown
   - Enable "Automatically manage signing"
   - Verify Bundle Identifier: `com.commndx.app`

3. **General tab**:
   - Set **Version**: 1.0.15 (match package.json)
   - Set **Build**: 15 (increment for each TestFlight/App Store upload)

4. **Build Settings tab**:
   - Ensure "iOS Deployment Target" is 14.0

### Step 3: Archive and Upload

1. Select **"Any iOS Device (arm64)"** as the build target
2. Go to **Product → Archive**
3. Wait for archive to complete
4. **Window → Organizer** opens automatically
5. Select the archive → **Distribute App**
6. Choose **"App Store Connect"** → **Upload**
7. Follow prompts to complete upload

### Step 4: App Store Connect Setup

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Create new app or select existing "Command X"
3. Complete app information:

   **App Information**:
   - Primary Language: English (U.S.)
   - Category: Business
   - Content Rights: Does not contain third-party content
   
   **Pricing and Availability**:
   - Price: Free (or set your price)
   - Availability: All countries
   
   **App Privacy**:
   - Privacy Policy URL: (your URL)
   - Data collection types (already in PrivacyInfo.xcprivacy):
     - Precise Location (linked to user)
     - Email, Name, Phone (linked to user)
   
   **Version Information**:
   - Screenshots (required sizes):
     - 6.7" (iPhone 15 Pro Max): 1290 x 2796 px
     - 6.5" (iPhone 14 Plus): 1284 x 2778 px
     - 5.5" (iPhone 8 Plus): 1242 x 2208 px
   - App description (max 4000 chars)
   - Keywords (max 100 chars, comma-separated)
   - Support URL
   - Marketing URL (optional)

4. Select your uploaded build
5. Submit for Review

---

## Android Release Process

### Step 1: Create Signing Keystore (First Time Only)

```bash
# Generate keystore (keep this file secure!)
keytool -genkey -v -keystore commandx-release.keystore \
  -alias commandx \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# You'll be prompted for:
# - Keystore password
# - Key password
# - Your name, organization, etc.
```

⚠️ **IMPORTANT**: Store the keystore file and passwords securely. You'll need them for ALL future updates!

### Step 2: Configure Signing

Create `android/local.properties` (this file is git-ignored):

```properties
sdk.dir=/path/to/your/Android/Sdk

# Release signing configuration
RELEASE_STORE_FILE=../commandx-release.keystore
RELEASE_STORE_PASSWORD=your_keystore_password
RELEASE_KEY_ALIAS=commandx
RELEASE_KEY_PASSWORD=your_key_password
```

### Step 3: Build Release Bundle

```bash
# Build web app and sync
npm run build
npx cap sync android

# Build release AAB (for Play Store)
cd android
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab
```

For APK (direct install/testing):
```bash
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

### Step 4: Google Play Console Setup

1. Go to [play.google.com/console](https://play.google.com/console)
2. Create new app or select existing

   **App Details**:
   - App name: Command X
   - Default language: English (United States)
   - App or game: App
   - Free or paid: Free
   
   **Store Listing**:
   - Short description (max 80 chars)
   - Full description (max 4000 chars)
   - App icon: 512 x 512 px
   - Feature graphic: 1024 x 500 px
   - Screenshots (minimum 2):
     - Phone: 16:9 or 9:16 aspect ratio
     - 7" tablet (if supporting)
     - 10" tablet (if supporting)
   
   **Content Rating**:
   - Complete the questionnaire
   - Command X likely qualifies for "Everyone"
   
   **Target Audience**:
   - Not designed for children (18+)
   
   **Privacy Policy**:
   - Add your privacy policy URL

3. **Create Release**:
   - Go to Production → Create new release
   - Upload your AAB file
   - Add release notes
   - Review and roll out

---

## Version Management

### Before Each Release

1. **Update package.json**:
   ```json
   "version": "1.0.16"
   ```

2. **Update android/app/build.gradle**:
   ```gradle
   versionCode 16  // Always increment by 1
   versionName "1.0.16"
   ```

3. **Update in Xcode** (or Info.plist):
   - Version (CFBundleShortVersionString): 1.0.16
   - Build (CFBundleVersion): 16

### Version Numbering Convention

- **Major.Minor.Patch** format (e.g., 1.0.15)
- Increment patch for bug fixes
- Increment minor for new features
- Increment major for breaking changes

---

## Required Assets

### App Icons

**iOS** (already configured in Assets.xcassets):
- 1024x1024 px (App Store)
- Xcode generates all other sizes

**Android** (in res/mipmap folders):
- ic_launcher.png (mdpi: 48px, hdpi: 72px, xhdpi: 96px, xxhdpi: 144px, xxxhdpi: 192px)
- ic_launcher_round.png (same sizes)
- Adaptive icons: ic_launcher_foreground.xml + ic_launcher_background.xml

### Screenshots

**iOS Screenshots**:
| Device | Size |
|--------|------|
| iPhone 15 Pro Max (6.7") | 1290 x 2796 |
| iPhone 14 Plus (6.5") | 1284 x 2778 |
| iPhone 8 Plus (5.5") | 1242 x 2208 |

**Android Screenshots**:
| Type | Minimum |
|------|---------|
| Phone | 2 screenshots, 16:9 or 9:16 |
| Feature Graphic | 1024 x 500 |
| App Icon | 512 x 512 |

---

## Privacy Policy

Your app collects the following data (required for store listings):

| Data Type | Purpose | Linked to User |
|-----------|---------|----------------|
| Precise Location | Time clock geofencing | Yes |
| Email Address | Account authentication | Yes |
| Name | User identification | Yes |
| Phone Number | Contact/SMS features | Yes |
| Employment Data | Time tracking | Yes |

Create a privacy policy at:
- [Termly](https://app.termly.io) (free)
- [PrivacyPolicies.com](https://www.privacypolicies.com)
- Your company's legal team

---

## Troubleshooting

### iOS Common Issues

**"Provisioning profile doesn't include signing certificate"**
- Xcode → Preferences → Accounts → Manage Certificates → Create new

**"No matching provisioning profiles found"**
- Enable "Automatically manage signing" in Xcode

**App rejected for missing permissions**
- Ensure all NSUsageDescription keys are in Info.plist

### Android Common Issues

**"Keystore was tampered with"**
- Wrong password - double-check local.properties

**APK not installing**
- Enable "Install unknown apps" in device settings
- Check minimum SDK version compatibility

**ProGuard errors**
- Check proguard-rules.pro for missing keep rules

---

## Quick Commands Reference

```bash
# Development
npm run dev                    # Start development server
npx cap sync                   # Sync web to native

# iOS
npx cap open ios               # Open in Xcode
npx cap run ios                # Run on device/simulator
npx cap run ios --list         # List available devices

# Android
npx cap open android           # Open in Android Studio
npx cap run android            # Run on device/emulator
npx cap run android --list     # List available devices

# Build
npm run build                  # Build production web app
cd android && ./gradlew bundleRelease  # Build Android AAB
cd android && ./gradlew assembleRelease # Build Android APK
```

---

## Support

For Capacitor-specific issues:
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor GitHub Issues](https://github.com/ionic-team/capacitor/issues)

For store submission help:
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy Center](https://play.google.com/console/about/policy-center/)

# Authentication Setup Guide

## Overview
Your app now includes native login with Apple and Google Sign-In. Here's how to complete the setup:

## 🔧 Configuration Required

### 1. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - **iOS**: Bundle ID: `app.rork.ifs-therapy-conversational-app`
   - **Android**: Package name: `app.rork.ifs-therapy-conversational-app`
   - **Web**: Add your domain

5. Update `providers/auth-provider.tsx` with your client IDs:
```typescript
const GOOGLE_CLIENT_ID = {
  ios: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  android: 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com', 
  web: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
};
```

### 2. Apple Sign-In Setup
- Apple Sign-In works automatically on iOS devices
- For web/Android, it shows a fallback button (limited functionality)
- No additional configuration needed for basic setup

### 3. App Configuration (app.json)
Add to your `app.json`:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "app.rork.ifs-therapy-conversational-app",
      "infoPlist": {
        "UIBackgroundModes": ["audio"],
        "NSMicrophoneUsageDescription": "Allow $(PRODUCT_NAME) to access your microphone"
      }
    },
    "android": {
      "package": "app.rork.ifs-therapy-conversational-app",
      "permissions": ["RECORD_AUDIO"]
    }
  }
}
```

## 🚀 Features Implemented

### ✅ What's Working
- **Google Sign-In**: Full OAuth flow with user profile
- **Apple Sign-In**: Native iOS authentication
- **Secure Storage**: User data encrypted on device
- **Web Compatibility**: localStorage fallback for web
- **Auth Guard**: Automatic redirect to login when not authenticated
- **Sign Out**: Secure logout with confirmation
- **User Greeting**: Shows user's first name in header

### 🔄 Authentication Flow
1. App starts → Check for stored user
2. If no user → Redirect to `/login`
3. User signs in → Store credentials securely
4. Redirect to main app with user context
5. Sign out → Clear credentials and redirect to login

### 🎨 UI Components
- **Login Screen**: Beautiful gradient with native sign-in buttons
- **Auth Guard**: Loading state while checking authentication
- **User Display**: Shows greeting in main header
- **Sign Out Button**: Added to main screen header

## 🔒 Security Features
- **Secure Storage**: Uses Expo SecureStore on mobile, localStorage on web
- **Token Management**: Handles OAuth tokens securely
- **Auto-logout**: Clears all data on sign out
- **Platform-specific**: Different storage strategies per platform

## 📱 Testing
1. Run the app
2. Should automatically redirect to login screen
3. Try Google Sign-In (requires valid client ID)
4. Try Apple Sign-In (iOS only)
5. Check user greeting appears after login
6. Test sign out functionality

## 🚨 Next Steps
1. **Configure Google OAuth** with your client IDs
2. **Test on physical devices** for full native experience
3. **Add error handling** for network issues
4. **Implement refresh tokens** for long-term sessions
5. **Add profile management** features if needed

## 🔧 Troubleshooting
- **Google Sign-In fails**: Check client ID configuration
- **Apple Sign-In unavailable**: Only works on iOS devices
- **Storage errors**: Check device permissions
- **Redirect issues**: Verify scheme configuration

Your authentication system is now ready! Update the Google client IDs and you'll have a fully functional login system.
# OAuth Setup Guide (Google & Apple Sign-In)

## ✅ What's Already Done

- ✅ Login page with Google/Apple buttons
- ✅ Signup page with Google/Apple buttons
- ✅ OAuth callback handler (`/auth/callback`)
- ✅ Better error messages when user doesn't exist
- ✅ Animated "Sign up" button highlight when account not found

## 🔧 Supabase Configuration Required

You need to enable and configure OAuth providers in your Supabase dashboard.

### 1. Enable Google OAuth

#### A. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Configure OAuth consent screen:
   - App name: `Fit-Hub`
   - User support email: Your email
   - Developer contact: Your email
6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `Fit-Hub Web`
   - Authorized redirect URIs:
     ```
     https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
     ```
     (Get this from Supabase dashboard → Authentication → Providers → Google)

7. Copy **Client ID** and **Client Secret**

#### B. Configure in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Google** and toggle it **ON**
5. Paste:
   - Client ID (from step A.7)
   - Client Secret (from step A.7)
6. Click **Save**

---

### 2. Enable Apple OAuth

#### A. Create Apple App ID & Service ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. **Prerequisites**:
   - Enrolled in Apple Developer Program ($99/year)
   - Have a verified domain

3. **Create App ID**:
   - Go to **Certificates, Identifiers & Profiles**
   - Click **Identifiers** → **+** button
   - Select **App IDs** → Continue
   - Description: `Fit-Hub`
   - Bundle ID: `com.fithub.app` (example)
   - Enable **Sign in with Apple**
   - Click **Continue** → **Register**

4. **Create Service ID**:
   - Click **Identifiers** → **+** button
   - Select **Services IDs** → Continue
   - Description: `Fit-Hub Web`
   - Identifier: `com.fithub.web` (example)
   - Enable **Sign in with Apple**
   - Click **Configure** next to Sign in with Apple
   - Primary App ID: Select the App ID you just created
   - Domains: `<your-supabase-project-ref>.supabase.co`
   - Return URLs: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
   - Click **Save** → **Continue** → **Register**

5. **Create Private Key**:
   - Go to **Keys** → **+** button
   - Key Name: `Fit-Hub Sign in with Apple Key`
   - Enable **Sign in with Apple**
   - Click **Configure** → Select your Primary App ID
   - Click **Save** → **Continue** → **Register**
   - **Download the .p8 file** (you can only download once!)
   - Note the **Key ID** shown

#### B. Configure in Supabase

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Find **Apple** and toggle it **ON**
3. Fill in:
   - **Services ID**: `com.fithub.web` (from step A.4)
   - **Team ID**: Found in Apple Developer Account (top-right corner)
   - **Key ID**: From step A.5
   - **Secret Key**: Open the .p8 file you downloaded and paste the entire contents
4. Click **Save**

---

## 🧪 Testing

### Test Google Login:
1. Go to `/login`
2. Click "Continue with Google"
3. Select your Google account
4. You should be redirected to `/onboarding` (new user) or `/dashboard` (returning user)

### Test Apple Login:
1. Go to `/login`
2. Click "Continue with Apple"
3. Sign in with Apple ID
4. First time: Choose to share or hide email
5. You should be redirected to `/onboarding` or `/dashboard`

### Test "User Not Found" Error:
1. Go to `/login`
2. Enter email that doesn't exist: `test@example.com`
3. Enter any password
4. Click "Sign In"
5. ✅ Should see:
   - Red error message: "Account not found. Please sign up first."
   - "Account not found with this email" warning above footer
   - **"Sign up" link with animated ring highlight**

---

## 🚨 Common Issues

### Google OAuth Not Working
- **Issue**: "Redirect URI mismatch"
- **Fix**: Make sure the redirect URI in Google Console **exactly** matches what's in Supabase (including trailing slash)

### Apple OAuth Not Working
- **Issue**: "invalid_client"
- **Fix**:
  - Verify Service ID matches exactly
  - Check that .p8 key file contents are pasted correctly (entire file, including header/footer)
  - Verify domain and return URL are correct

### Users Get Stuck on Callback
- **Issue**: Redirects to callback but doesn't proceed
- **Fix**: Check browser console for errors. Ensure `/api/auth/ensure-profile` endpoint exists and works.

---

## 📋 Local Development Notes

For **local testing** (localhost), Google OAuth requires additional setup:
1. Add `http://localhost:3000/auth/callback` to Google OAuth authorized redirect URIs
2. Apple OAuth does **not** work on localhost (requires HTTPS domain)
3. Use Supabase preview deployments or ngrok for Apple testing

---

## 🔐 Security Best Practices

1. **Never commit** OAuth secrets to git
2. Store secrets in Supabase dashboard only
3. Use different OAuth apps for production vs staging
4. Rotate keys/secrets if compromised
5. Review OAuth scopes - only request what you need

---

## ✅ Verification Checklist

- [ ] Google OAuth enabled in Supabase
- [ ] Google Client ID/Secret configured
- [ ] Apple OAuth enabled in Supabase
- [ ] Apple Service ID, Team ID, Key ID, Secret Key configured
- [ ] Test Google login works
- [ ] Test Apple login works
- [ ] Test "user not found" error highlights signup button
- [ ] Test OAuth user gets redirected to onboarding (first time)
- [ ] Test OAuth user gets redirected to dashboard (returning)

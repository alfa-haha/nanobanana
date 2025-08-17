# Google OAuth Implementation - Nano Banana

This document describes the Google OAuth login implementation for the Nano Banana AI image generation platform.

## Overview

The Google OAuth integration allows users to:
- Sign in with their Google account
- Receive 10 bonus image generations upon registration
- Save their generation history
- Access premium features
- Manage their credits and subscriptions

## Implementation Details

### 1. Authentication Manager (`js/auth-manager.js`)

The `AuthManager` class handles all authentication-related functionality:

- **Supabase Integration**: Uses Supabase Auth for Google OAuth
- **Session Management**: Handles user sessions and token refresh
- **Profile Management**: Loads and manages user profile data
- **UI Updates**: Updates authentication UI elements

#### Key Methods:
- `signInWithGoogle()`: Initiates Google OAuth flow
- `signOut()`: Signs out the user and clears session
- `loadUserProfile()`: Loads user profile from database
- `onAuthStateChange()`: Handles authentication state changes

### 2. Database Integration

The implementation integrates with the existing Supabase database:

#### Tables Used:
- `auth.users`: Supabase built-in user table
- `profiles`: Extended user profile with credits and subscription info
- `credit_transactions`: Tracks credit usage and bonuses

#### Bonus Credits:
- New users receive 15 total credits (5 free + 10 registration bonus)
- Bonus is automatically added via database trigger
- Credits are tracked in the `profiles` table

### 3. UI Components

#### Login Button:
- Shows "Sign In" when not authenticated
- Shows user avatar and dropdown when authenticated
- Includes user credits display

#### User Dropdown:
- Profile access
- Image history
- Billing management
- Sign out option

#### Authentication Modal:
- Appears when anonymous users reach their limit
- Shows benefits of signing up
- Provides Google sign-in button

### 4. CSS Styles (`css/styles.css`)

Added comprehensive styles for:
- Login button states
- User dropdown menu
- Authentication modal
- Loading states
- Responsive design

## Configuration

### Supabase Configuration:
```javascript
supabaseUrl: 'https://gpsxrvqgnxqafftxdilc.supabase.co'
supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Google OAuth Configuration:
```
Client ID: 456062516497-d8jt0kaqhd6247t47rgci3vkcj85ch1b.apps.googleusercontent.com
Client Secret: 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
```

## File Structure

```
js/
├── auth-manager.js          # Main authentication manager
├── app.js                   # Updated with auth integration
└── anonymous-user.js        # Existing anonymous user system

css/
└── styles.css               # Updated with auth styles

test-google-oauth.html       # OAuth testing page
validate-google-oauth.js     # Validation script
index.html                   # Updated with auth script
```

## Testing

### Manual Testing:
1. Open `test-google-oauth.html` in browser
2. Click "Sign In with Google"
3. Complete OAuth flow
4. Verify user profile loads
5. Test sign out functionality

### Automated Validation:
```javascript
// Run in browser console
validateGoogleOAuth()
```

## Integration with Main App

The main `NanoBananaApp` class now includes:

1. **AuthManager Integration**:
   ```javascript
   this.authManager = new AuthManager();
   ```

2. **Authentication State Handling**:
   ```javascript
   onAuthStateChange(event, session, userProfile) {
       // Handle login/logout state changes
   }
   ```

3. **Credit Management**:
   - Checks user credits before generation
   - Deducts credits after successful generation
   - Shows appropriate prompts for insufficient credits

4. **UI Updates**:
   - Updates login button based on auth state
   - Shows user credits in header
   - Displays authentication prompts

## Security Features

1. **Secure Token Handling**: Uses Supabase's secure token management
2. **Row Level Security**: Database policies ensure users can only access their own data
3. **HTTPS Required**: OAuth requires secure connections
4. **Token Refresh**: Automatic token refresh handling

## Error Handling

The implementation includes comprehensive error handling for:
- Network connectivity issues
- OAuth flow interruptions
- Database connection problems
- Invalid or expired tokens
- User permission errors

## Future Enhancements

Potential improvements for future versions:
1. Social login with other providers (Facebook, Apple)
2. Two-factor authentication
3. Account linking for existing anonymous users
4. Advanced user profile management
5. OAuth scope customization

## Troubleshooting

### Common Issues:

1. **OAuth Popup Blocked**:
   - Ensure popup blockers are disabled
   - Use redirect flow instead of popup

2. **CORS Issues**:
   - Verify domain is added to Supabase allowed origins
   - Check Google OAuth authorized domains

3. **Database Connection**:
   - Verify Supabase credentials
   - Check RLS policies are correctly configured

4. **Credits Not Added**:
   - Check database trigger is active
   - Verify `handle_new_user()` function exists

## Support

For issues with the Google OAuth implementation:
1. Check browser console for errors
2. Verify Supabase project status
3. Test with the validation script
4. Review database logs in Supabase dashboard
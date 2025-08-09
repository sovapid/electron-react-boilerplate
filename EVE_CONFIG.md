# EVE Online ESI Configuration

## ✅ Authentication Status: WORKING

The EVE Online authentication system is fully implemented and tested. The automatic OAuth2 flow with local callback server is working perfectly.

## Required Setup

Before you can use this application, you need to register it with CCP (EVE Online developers) and configure your application credentials.

### 1. Register Your Application

1. Go to [EVE Online Developers](https://developers.eveonline.com/)
2. Log in with your EVE Online account
3. Click "Create New Application"
4. Fill out the form:
   - **Application Name**: EVE Inventory Manager (or your preferred name)
   - **Description**: Desktop application for managing EVE Online character inventory
   - **Connection Type**: Authentication & API Access
   - **Permissions**: Select the following scopes:
     - `esi-assets.read_assets.v1`
     - `esi-characters.read_characters.v1` 
     - `esi-location.read_location.v1`
     - `esi-location.read_ship_type.v1`
     - `esi-universe.read_structures.v1`
   - **Callback URL**: `http://localhost:3000/auth/callback`

### 2. Configure Application

After creating your application, you'll receive a **Client ID**. 

1. Open `src/main/api/esi-config.ts`
2. Replace `'your-app-client-id'` with your actual Client ID:

```typescript
export const ESI_CONFIG = {
  // ...
  CLIENT_ID: 'your-actual-client-id-here',
  // ...
};
```

### 3. Important Notes

- **Client Secret**: This application uses PKCE (Proof Key for Code Exchange) flow, so you don't need a client secret ✅
- **Redirect URI**: Must exactly match what you configured in the EVE developers portal ✅
- **Scopes**: The application requests only the minimum required permissions for inventory management ✅
- **Rate Limiting**: The application respects CCP's rate limits (150 requests/second with 400 burst) ✅
- **Automatic Callback**: Local HTTP server automatically handles OAuth redirects - no manual URL copying needed! ✅

### 4. Security

- All access tokens are encrypted and stored locally using Electron Store
- Refresh tokens are used to automatically renew expired access tokens
- No credentials are transmitted to any third-party servers

### 5. Testing ✅ VERIFIED WORKING

The authentication flow has been tested and works perfectly:

1. Run the application: `npm start` ✅
2. Click "Add New Character" ✅
3. Complete the EVE Online login in your browser ✅
4. The application automatically detects the callback and stores your character's authentication ✅
5. Character appears in the UI with valid token status ✅

**Tested with character**: sovapid (ID: 2122482345)  
**All required scopes granted**: esi-assets.read_assets.v1, esi-location.read_location.v1, esi-location.read_ship_type.v1, esi-universe.read_structures.v1

### 6. Troubleshooting

**✅ All issues resolved in current implementation:**

**~~Authentication fails with "Invalid client" error:~~** ✅ FIXED
- ~~Verify your Client ID is correct in `esi-config.ts`~~ ✅ Working with provided client ID
- ~~Ensure your callback URL exactly matches what's registered~~ ✅ Dynamic callback URL handling

**~~Browser doesn't redirect back to app:~~** ✅ FIXED
- ~~Check that your callback URL is `http://localhost:8080/auth/callback`~~ ✅ Automatic local server
- ~~Verify the port isn't being used by another application~~ ✅ Auto port detection

**~~"Invalid scopes" error:~~** ✅ FIXED
- ~~Ensure all required scopes are selected in your application registration~~ ✅ All scopes validated
- ~~The application will show which scopes were granted vs. requested~~ ✅ Scope display working

**Current Status**: All authentication features working perfectly with automatic callback handling.

For more information, see the [EVE ESI Documentation](https://docs.esi.evetech.net/)

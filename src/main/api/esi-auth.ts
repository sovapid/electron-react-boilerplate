import { shell, BrowserWindow } from 'electron';
import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { ESI_CONFIG, ESI_ENDPOINTS, USER_AGENT } from './esi-config';
import { EVEAuthTokens, EVECharacter, StoredCharacterAuth, EVEError } from './types';
import { CallbackServer } from './callback-server';

export class ESIAuthManager {
  private codeVerifier: string | null = null;
  private authState: string | null = null;
  private callbackServer: CallbackServer;

  constructor() {
    this.callbackServer = new CallbackServer();
  }

  /**
   * Generate PKCE code verifier and challenge for secure OAuth2 flow
   */
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate a random state parameter for OAuth2 security
   */
  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

    /**
   * Initiate the OAuth2 authorization flow with automatic callback handling
   */
  public async initiateAuth(): Promise<string> {
    const { codeVerifier, codeChallenge } = this.generatePKCE();
    const state = this.generateState();

    this.codeVerifier = codeVerifier;
    this.authState = state;

    // Start the callback server
    const callbackPromise = this.callbackServer.startServer();
    const callbackUrl = this.callbackServer.getCallbackUrl();

    const params = new URLSearchParams({
      response_type: 'code',
      redirect_uri: callbackUrl,
      client_id: ESI_CONFIG.CLIENT_ID,
      scope: ESI_CONFIG.REQUIRED_SCOPES.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `${ESI_CONFIG.ESI_OAUTH_URL}${ESI_ENDPOINTS.AUTHORIZE}?${params.toString()}`;

    console.log('Opening EVE auth URL:', authUrl);
    console.log('Callback server listening on:', callbackUrl);

    // Open the authorization URL in the user's default browser
    await shell.openExternal(authUrl);

    // Wait for the callback
    return callbackPromise;
  }

    /**
   * Handle the OAuth2 callback and exchange code for tokens
   */
  public async handleCallback(callbackUrl: string): Promise<StoredCharacterAuth> {
    console.log('=== Starting handleCallback ===');
    console.log('Callback URL:', callbackUrl);

    const url = new URL(callbackUrl);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    console.log('Extracted code:', code?.substring(0, 10) + '...');
    console.log('Extracted state:', state);
    console.log('Any error:', error);

    // Check for errors
    if (error) {
      throw new Error(`OAuth2 error: ${error} - ${url.searchParams.get('error_description') || 'Unknown error'}`);
    }

    // Validate state parameter
    if (state !== this.authState) {
      console.log('State mismatch - expected:', this.authState, 'got:', state);
      throw new Error('Invalid state parameter - potential CSRF attack');
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    if (!this.codeVerifier) {
      throw new Error('No code verifier available - initiate auth first');
    }

    console.log('=== Exchanging code for tokens ===');
    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code, this.codeVerifier);
    console.log('Token exchange successful, access token starts with:', tokens.access_token.substring(0, 10) + '...');

    console.log('=== Getting character information ===');
    // Get character information and verification data
    const { character, scopes } = await this.getCharacterInfo(tokens.access_token);

    // Create stored auth object
    const storedAuth: StoredCharacterAuth = {
      character_id: character.character_id,
      character_name: character.character_name,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires: Date.now() + (tokens.expires_in * 1000),
      scopes: scopes,
      last_updated: Date.now()
    };

    // Clear temporary auth data
    this.codeVerifier = null;
    this.authState = null;

    return storedAuth;
  }

  /**
   * Exchange authorization code for access tokens
   */
  private async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<EVEAuthTokens> {
    try {
      const response: AxiosResponse<EVEAuthTokens> = await axios.post(
        `${ESI_CONFIG.ESI_OAUTH_URL}${ESI_ENDPOINTS.TOKEN}`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: ESI_CONFIG.REDIRECT_URI,
          client_id: ESI_CONFIG.CLIENT_ID,
          code_verifier: codeVerifier
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT
          }
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const eveError = error.response.data as EVEError;
        throw new Error(`Token exchange failed: ${eveError.error} - ${eveError.error_description || 'Unknown error'}`);
      }
      throw new Error(`Token exchange failed: ${error}`);
    }
  }

  /**
   * Refresh an expired access token
   */
  public async refreshToken(refreshToken: string): Promise<EVEAuthTokens> {
    try {
      const response: AxiosResponse<EVEAuthTokens> = await axios.post(
        `${ESI_CONFIG.ESI_OAUTH_URL}${ESI_ENDPOINTS.TOKEN}`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: ESI_CONFIG.CLIENT_ID
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT
          }
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const eveError = error.response.data as EVEError;
        throw new Error(`Token refresh failed: ${eveError.error} - ${eveError.error_description || 'Unknown error'}`);
      }
      throw new Error(`Token refresh failed: ${error}`);
    }
  }

  /**
   * Get character information from the EVE API
   */
  private async getCharacterInfo(accessToken: string): Promise<{ character: EVECharacter; scopes: string[] }> {
    try {
            // First, verify the token and get character ID
      // Try the correct EVE verification endpoint
      const verifyUrl = 'https://login.eveonline.com/oauth/verify';
      console.log('Token verification URL:', verifyUrl);

      const verifyResponse = await axios.get(verifyUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': USER_AGENT
        }
      });

      console.log('Token verification response:', verifyResponse.data);
      const characterId = verifyResponse.data.CharacterID;
      console.log('Character ID:', characterId);

            // Let's create a simple character object from the verification data for now
      // and skip the additional character info call that's failing
      const character: EVECharacter = {
        character_id: characterId,
        character_name: verifyResponse.data.CharacterName || `Character_${characterId}`,
        corporation_id: 0, // We'll get this later
        alliance_id: undefined,
        birthday: '',
        race_id: 0,
        bloodline_id: 0,
        ancestry_id: 0,
        security_status: 0,
        gender: 'male'
      };

      console.log('Created basic character object:', character);

      // Parse scopes from the verification response
      const scopes = verifyResponse.data.Scopes ? verifyResponse.data.Scopes.split(' ') : [];
      console.log('Parsed scopes:', scopes);

      return { character, scopes };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('Character info error response:', error.response.data);
        throw new Error(`Failed to get character info: ${error.response.status} - ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Failed to get character info: ${error}`);
    }
  }

  /**
   * Verify if a token is still valid
   */
  public async verifyToken(accessToken: string): Promise<boolean> {
    try {
      await axios.get(
        `${ESI_CONFIG.ESI_OAUTH_URL}${ESI_ENDPOINTS.VERIFY}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': USER_AGENT
          }
        }
      );
      return true;
    } catch {
      return false;
    }
  }


}

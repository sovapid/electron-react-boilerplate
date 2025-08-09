import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ESI_CONFIG, ESI_ENDPOINTS, USER_AGENT } from './esi-config';
import { EVEAsset, EVECharacter, EVEType, ESIResponse } from './types';
import { AuthStore } from '../storage/auth-store';
import { ESIAuthManager } from './esi-auth';

export class ESIClient {
  private client: AxiosInstance;
  private authStore: AuthStore;
  private authManager: ESIAuthManager;
  private rateLimitQueue: Array<() => void> = [];
  private isProcessingQueue = false;

  constructor() {
    this.authStore = new AuthStore();
    this.authManager = new ESIAuthManager();

    this.client = axios.create({
      baseURL: ESI_CONFIG.ESI_BASE_URL,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    // Setup request/response interceptors
    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for authentication and rate limiting
   */
  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use(async (config) => {
      // Add rate limiting queue
      await this.addToRateLimitQueue();
      return config;
    });

    // Response interceptor for error handling and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized - token expired
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const characterId = originalRequest._characterId;
          if (characterId) {
            try {
              await this.refreshCharacterToken(characterId);
              const auth = this.authStore.getCharacterAuth(characterId);
              if (auth) {
                originalRequest.headers.Authorization = `Bearer ${auth.access_token}`;
                return this.client(originalRequest);
              }
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError);
              // Remove invalid auth
              this.authStore.removeCharacterAuth(characterId);
            }
          }
        }

        // Handle rate limiting (420 or 429)
        if (error.response?.status === 420 || error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
          console.warn(`Rate limited. Retrying after ${retryAfter} seconds`);

          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          return this.client(originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Simple rate limiting queue
   */
  private async addToRateLimitQueue(): Promise<void> {
    return new Promise((resolve) => {
      this.rateLimitQueue.push(resolve);
      this.processRateLimitQueue();
    });
  }

  private processRateLimitQueue(): void {
    if (this.isProcessingQueue || this.rateLimitQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const next = this.rateLimitQueue.shift();

    if (next) {
      next();
      // Process next request after a short delay (rate limiting)
      setTimeout(() => {
        this.isProcessingQueue = false;
        this.processRateLimitQueue();
      }, 1000 / ESI_CONFIG.RATE_LIMIT.DEFAULT);
    } else {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Make an authenticated request
   */
  private async makeAuthenticatedRequest<T>(
    characterId: number,
    endpoint: string,
    options: any = {}
  ): Promise<AxiosResponse<T>> {
    const auth = this.authStore.getCharacterAuth(characterId);
    if (!auth) {
      throw new Error(`No authentication found for character ${characterId}`);
    }

    // Check if token is expired and refresh if needed
    if (this.authStore.isTokenExpired(characterId)) {
      await this.refreshCharacterToken(characterId);
      const refreshedAuth = this.authStore.getCharacterAuth(characterId);
      if (!refreshedAuth) {
        throw new Error(`Failed to refresh token for character ${characterId}`);
      }
    }

    const config = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${auth.access_token}`
      },
      _characterId: characterId // Custom property for interceptor
    };

    return this.client.get<T>(endpoint, config);
  }

  /**
   * Refresh a character's access token
   */
  private async refreshCharacterToken(characterId: number): Promise<void> {
    const auth = this.authStore.getCharacterAuth(characterId);
    if (!auth) {
      throw new Error(`No authentication found for character ${characterId}`);
    }

    try {
      const newTokens = await this.authManager.refreshToken(auth.refresh_token);

      this.authStore.updateCharacterAuth(characterId, {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        token_expires: Date.now() + (newTokens.expires_in * 1000),
        last_updated: Date.now()
      });
    } catch (error) {
      console.error(`Failed to refresh token for character ${characterId}:`, error);
      throw error;
    }
  }

  /**
   * Get character information
   */
  public async getCharacterInfo(characterId: number): Promise<EVECharacter> {
    const response = await this.makeAuthenticatedRequest<EVECharacter>(
      characterId,
      ESI_ENDPOINTS.CHARACTER_INFO(characterId)
    );
    return response.data;
  }

  /**
   * Get character assets/inventory
   */
  public async getCharacterAssets(characterId: number): Promise<EVEAsset[]> {
    const response = await this.makeAuthenticatedRequest<EVEAsset[]>(
      characterId,
      ESI_ENDPOINTS.CHARACTER_ASSETS(characterId)
    );
    return response.data;
  }

  /**
   * Get character's current location
   */
  public async getCharacterLocation(characterId: number): Promise<{ solar_system_id: number; station_id?: number; structure_id?: number }> {
    const response = await this.makeAuthenticatedRequest<{ solar_system_id: number; station_id?: number; structure_id?: number }>(
      characterId,
      ESI_ENDPOINTS.CHARACTER_LOCATION(characterId)
    );
    return response.data;
  }

  /**
   * Get character's current ship
   */
  public async getCharacterShip(characterId: number): Promise<{ ship_type_id: number; ship_item_id: number; ship_name: string }> {
    const response = await this.makeAuthenticatedRequest<{ ship_type_id: number; ship_item_id: number; ship_name: string }>(
      characterId,
      ESI_ENDPOINTS.CHARACTER_SHIP(characterId)
    );
    return response.data;
  }

  /**
   * Get type information (not authenticated)
   */
  public async getTypeInfo(typeId: number): Promise<EVEType> {
    const response = await this.client.get<EVEType>(ESI_ENDPOINTS.TYPE_INFO(typeId));
    return response.data;
  }

  /**
   * Get structure information
   */
  public async getStructureInfo(characterId: number, structureId: number): Promise<{ name: string; type_id: number; system_id: number }> {
    const response = await this.makeAuthenticatedRequest<{ name: string; type_id: number; system_id: number }>(
      characterId,
      ESI_ENDPOINTS.STRUCTURE_INFO(structureId)
    );
    return response.data;
  }

  /**
   * Get station information (not authenticated)
   */
  public async getStationInfo(stationId: number): Promise<{ name: string; type_id: number; system_id: number }> {
    const response = await this.client.get<{ name: string; type_id: number; system_id: number }>(
      ESI_ENDPOINTS.STATION_INFO(stationId)
    );
    return response.data;
  }

  /**
   * Get system information (not authenticated)
   */
  public async getSystemInfo(systemId: number): Promise<{ name: string; constellation_id: number; region_id: number; security_status: number }> {
    const response = await this.client.get<{ name: string; constellation_id: number; region_id: number; security_status: number }>(
      ESI_ENDPOINTS.SYSTEM_INFO(systemId)
    );
    return response.data;
  }

  /**
   * Check EVE server status (not authenticated)
   */
  public async getServerStatus(): Promise<{ players: number; server_version: string; start_time: string; vip?: boolean }> {
    const response = await this.client.get<{ players: number; server_version: string; start_time: string; vip?: boolean }>(
      ESI_ENDPOINTS.SERVER_STATUS
    );
    return response.data;
  }

  /**
   * Get auth store instance
   */
  public getAuthStore(): AuthStore {
    return this.authStore;
  }

  /**
   * Get auth manager instance
   */
  public getAuthManager(): ESIAuthManager {
    return this.authManager;
  }
}

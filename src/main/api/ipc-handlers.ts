import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { EnhancedESIClient } from './enhanced-esi-client';
import { StoredCharacterAuth, EVECharacter, EVEAsset } from './types';

export class IPCHandlers {
  private esiClient: EnhancedESIClient;

  constructor() {
    this.esiClient = new EnhancedESIClient();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Authentication handlers
    ipcMain.handle('auth:initiate', this.handleInitiateAuth.bind(this));
    ipcMain.handle('auth:callback', this.handleAuthCallback.bind(this));
    ipcMain.handle('auth:get-characters', this.handleGetCharacters.bind(this));
    ipcMain.handle('auth:remove-character', this.handleRemoveCharacter.bind(this));
    ipcMain.handle('auth:get-selected-character', this.handleGetSelectedCharacter.bind(this));
    ipcMain.handle('auth:set-selected-character', this.handleSetSelectedCharacter.bind(this));

    // Character data handlers
    ipcMain.handle('character:get-info', this.handleGetCharacterInfo.bind(this));
    ipcMain.handle('character:get-assets', this.handleGetCharacterAssets.bind(this));
    ipcMain.handle('character:get-location', this.handleGetCharacterLocation.bind(this));
    ipcMain.handle('character:get-ship', this.handleGetCharacterShip.bind(this));

    // Universe data handlers
    ipcMain.handle('universe:get-type-info', this.handleGetTypeInfo.bind(this));
    ipcMain.handle('universe:get-structure-info', this.handleGetStructureInfo.bind(this));
    ipcMain.handle('universe:get-station-info', this.handleGetStationInfo.bind(this));
    ipcMain.handle('universe:get-system-info', this.handleGetSystemInfo.bind(this));
    ipcMain.handle('universe:get-server-status', this.handleGetServerStatus.bind(this));

    // Database handlers
    ipcMain.handle('database:get-cached-assets', this.handleGetCachedAssets.bind(this));
    ipcMain.handle('database:refresh-assets', this.handleRefreshAssets.bind(this));
    ipcMain.handle('database:search-assets', this.handleSearchAssets.bind(this));
    ipcMain.handle('database:get-asset-stats', this.handleGetAssetStats.bind(this));
    ipcMain.handle('database:get-stats', this.handleGetDatabaseStats.bind(this));
    ipcMain.handle('database:cache-missing-types', this.handleCacheMissingTypes.bind(this));
    ipcMain.handle('database:reset', this.handleResetDatabase.bind(this));

    // Static data handlers
    ipcMain.handle('static-data:search-items', this.handleSearchStaticItems.bind(this));
    ipcMain.handle('static-data:get-item', this.handleGetStaticItem.bind(this));
    ipcMain.handle('static-data:get-stats', this.handleGetStaticDataStats.bind(this));
  }

  // Authentication handlers
  private async handleInitiateAuth(event: IpcMainInvokeEvent): Promise<StoredCharacterAuth> {
    try {
      // Start auth and wait for callback automatically
      const callbackUrl = await this.esiClient.getAuthManager().initiateAuth();

      // Process the callback
      const authData = await this.esiClient.getAuthManager().handleCallback(callbackUrl);

      // Store the authentication data in legacy store
      this.esiClient.getAuthStore().storeCharacterAuth(authData);

      // Sync with database
      await this.esiClient.syncCharacterAuth({
        characterId: authData.character_id,
        characterName: authData.character_name,
        accessToken: authData.access_token,
        refreshToken: authData.refresh_token,
        tokenExpires: authData.token_expires,
        scopes: authData.scopes,
      });

      return authData;
    } catch (error) {
      throw new Error(`Authentication failed: ${error}`);
    }
  }

  private async handleAuthCallback(event: IpcMainInvokeEvent, callbackUrl: string): Promise<StoredCharacterAuth> {
    try {
      const authData = await this.esiClient.getAuthManager().handleCallback(callbackUrl);
      this.esiClient.getAuthStore().storeCharacterAuth(authData);
      return authData;
    } catch (error) {
      throw new Error(`Authentication callback failed: ${error}`);
    }
  }

  private async handleGetCharacters(event: IpcMainInvokeEvent): Promise<Array<Pick<StoredCharacterAuth, 'character_id' | 'character_name' | 'token_expires' | 'scopes' | 'last_updated'>>> {
    try {
      return this.esiClient.getAuthStore().getAllCharacters();
    } catch (error) {
      throw new Error(`Failed to get characters: ${error}`);
    }
  }

  private async handleRemoveCharacter(event: IpcMainInvokeEvent, characterId: number): Promise<void> {
    try {
      this.esiClient.getAuthStore().removeCharacterAuth(characterId);
    } catch (error) {
      throw new Error(`Failed to remove character: ${error}`);
    }
  }

  private async handleGetSelectedCharacter(event: IpcMainInvokeEvent): Promise<number | undefined> {
    try {
      return this.esiClient.getAuthStore().getLastSelectedCharacter();
    } catch (error) {
      throw new Error(`Failed to get selected character: ${error}`);
    }
  }

  private async handleSetSelectedCharacter(event: IpcMainInvokeEvent, characterId: number): Promise<void> {
    try {
      this.esiClient.getAuthStore().setLastSelectedCharacter(characterId);
    } catch (error) {
      throw new Error(`Failed to set selected character: ${error}`);
    }
  }

  // Character data handlers
  private async handleGetCharacterInfo(event: IpcMainInvokeEvent, characterId: number): Promise<EVECharacter> {
    try {
      return await this.esiClient.getCharacterInfo(characterId);
    } catch (error) {
      throw new Error(`Failed to get character info: ${error}`);
    }
  }

  private async handleGetCharacterAssets(event: IpcMainInvokeEvent, characterId: number): Promise<any[]> {
    try {
      // Use enhanced client with database fallback
      const result = await this.esiClient.getCharacterAssetsWithFallback(characterId);
      return result;
    } catch (error) {
      throw new Error(`Failed to get character assets: ${error}`);
    }
  }

  private async handleGetCharacterLocation(event: IpcMainInvokeEvent, characterId: number): Promise<{ solar_system_id: number; station_id?: number; structure_id?: number }> {
    try {
      return await this.esiClient.getCharacterLocation(characterId);
    } catch (error) {
      throw new Error(`Failed to get character location: ${error}`);
    }
  }

  private async handleGetCharacterShip(event: IpcMainInvokeEvent, characterId: number): Promise<{ ship_type_id: number; ship_item_id: number; ship_name: string }> {
    try {
      return await this.esiClient.getCharacterShip(characterId);
    } catch (error) {
      throw new Error(`Failed to get character ship: ${error}`);
    }
  }

  // Universe data handlers
  private async handleGetTypeInfo(event: IpcMainInvokeEvent, typeId: number): Promise<any> {
    try {
      return await this.esiClient.getTypeInfo(typeId);
    } catch (error) {
      throw new Error(`Failed to get type info: ${error}`);
    }
  }

  private async handleGetStructureInfo(event: IpcMainInvokeEvent, characterId: number, structureId: number): Promise<any> {
    try {
      return await this.esiClient.getStructureInfo(characterId, structureId);
    } catch (error) {
      throw new Error(`Failed to get structure info: ${error}`);
    }
  }

  private async handleGetStationInfo(event: IpcMainInvokeEvent, stationId: number): Promise<any> {
    try {
      return await this.esiClient.getStationInfo(stationId);
    } catch (error) {
      throw new Error(`Failed to get station info: ${error}`);
    }
  }

  private async handleGetSystemInfo(event: IpcMainInvokeEvent, systemId: number): Promise<any> {
    try {
      return await this.esiClient.getSystemInfo(systemId);
    } catch (error) {
      throw new Error(`Failed to get system info: ${error}`);
    }
  }

  private async handleGetServerStatus(event: IpcMainInvokeEvent): Promise<any> {
    try {
      return await this.esiClient.getServerStatus();
    } catch (error) {
      throw new Error(`Failed to get server status: ${error}`);
    }
  }

  // Database handlers
  private async handleGetCachedAssets(event: IpcMainInvokeEvent, characterId: number): Promise<any[]> {
    try {
      return await this.esiClient.getCachedCharacterAssets(characterId);
    } catch (error) {
      throw new Error(`Failed to get cached assets: ${error}`);
    }
  }

  private async handleRefreshAssets(event: IpcMainInvokeEvent, characterId: number): Promise<any[]> {
    try {
      return await this.esiClient.getCharacterAssetsWithFallback(characterId, true);
    } catch (error) {
      throw new Error(`Failed to refresh assets: ${error}`);
    }
  }

  private async handleSearchAssets(event: IpcMainInvokeEvent, characterId: number, searchTerm: string): Promise<any[]> {
    try {
      return await this.esiClient.searchCharacterAssets(characterId, searchTerm);
    } catch (error) {
      throw new Error(`Failed to search assets: ${error}`);
    }
  }

  private async handleGetAssetStats(event: IpcMainInvokeEvent, characterId: number): Promise<any> {
    try {
      return await this.esiClient.getCharacterAssetStats(characterId);
    } catch (error) {
      throw new Error(`Failed to get asset stats: ${error}`);
    }
  }

  private async handleGetDatabaseStats(event: IpcMainInvokeEvent): Promise<any> {
    try {
      return await this.esiClient.getDatabaseStats();
    } catch (error) {
      throw new Error(`Failed to get database stats: ${error}`);
    }
  }

  private async handleCacheMissingTypes(event: IpcMainInvokeEvent, typeIds: number[]): Promise<void> {
    try {
      await this.esiClient.batchCacheMissingTypes(typeIds);
    } catch (error) {
      throw new Error(`Failed to cache missing types: ${error}`);
    }
  }

  private async handleResetDatabase(event: IpcMainInvokeEvent): Promise<void> {
    try {
      const { resetDatabase } = await import('../database/db');
      await resetDatabase();
    } catch (error) {
      throw new Error(`Failed to reset database: ${error}`);
    }
  }

  // Static data handlers
  private async handleSearchStaticItems(event: IpcMainInvokeEvent, searchTerm: string, limit?: number): Promise<any[]> {
    try {
      return this.esiClient.getDatabaseManager().staticData.searchItemTypes(searchTerm, limit);
    } catch (error) {
      throw new Error(`Failed to search static items: ${error}`);
    }
  }

  private async handleGetStaticItem(event: IpcMainInvokeEvent, typeId: number): Promise<any> {
    try {
      return this.esiClient.getDatabaseManager().staticData.getItemType(typeId);
    } catch (error) {
      throw new Error(`Failed to get static item: ${error}`);
    }
  }

  private async handleGetStaticDataStats(event: IpcMainInvokeEvent): Promise<any> {
    try {
      const dbManager = this.esiClient.getDatabaseManager();
      await dbManager.initialize();
      return dbManager.staticData.getStats();
    } catch (error) {
      console.error('Error getting static data stats:', error);
      throw new Error(`Failed to get static data stats: ${error}`);
    }
  }
}

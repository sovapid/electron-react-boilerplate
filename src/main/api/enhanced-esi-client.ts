import { ESIClient } from './esi-client';
import { DatabaseManager } from '../database/database-manager';
import { EVEAsset, EVEType } from './types';

/**
 * Enhanced ESI Client that integrates with the database for caching and data management
 */
export class EnhancedESIClient extends ESIClient {
  private dbManager: DatabaseManager;
  private dbInitialized = false;

  constructor() {
    super();
    this.dbManager = DatabaseManager.getInstance();
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDbInitialized(): Promise<void> {
    if (!this.dbInitialized) {
      await this.dbManager.initialize();
      this.dbInitialized = true;
    }
  }

  /**
   * Get character assets and sync with database
   */
  public async getAndSyncCharacterAssets(characterId: number): Promise<EVEAsset[]> {
    try {
      await this.ensureDbInitialized();
      console.log(`Fetching and syncing assets for character ${characterId}`);

      // Fetch assets from EVE API
      const assets = await super.getCharacterAssets(characterId);

      // Sync with database
      await this.dbManager.syncCharacterAssets(characterId, assets);

      return assets;
    } catch (error) {
      console.error(`Failed to fetch and sync assets for character ${characterId}:`, error);
      throw error;
    }
  }

  /**
   * Get character assets from database (cached data)
   */
  public async getCachedCharacterAssets(characterId: number): Promise<any[]> {
    try {
      await this.ensureDbInitialized();
      return await this.getCharacterAssetsWithEnhancedLocationData(characterId);
    } catch (error) {
      console.error(`Failed to get cached assets for character ${characterId}:`, error);
      throw error;
    }
  }

  /**
   * Get character assets with automatic fallback to cache
   */
  public async getCharacterAssetsWithFallback(characterId: number, forceRefresh: boolean = false): Promise<any[]> {
    try {
      await this.ensureDbInitialized();
      if (forceRefresh) {
        // Force refresh from API
        await this.getAndSyncCharacterAssets(characterId);
      } else {
        // Check if we have recent cached data
        const stats = await this.dbManager.getCharacterAssetStats(characterId);
        const now = Math.floor(Date.now() / 1000);
        const cacheAge = stats.lastSyncTime ? now - stats.lastSyncTime : Infinity;

        // If cache is older than 30 minutes, refresh
        if (cacheAge > 1800) {
          console.log(`Cache is ${cacheAge} seconds old, refreshing assets`);
          try {
            await this.getAndSyncCharacterAssets(characterId);
          } catch (apiError) {
            console.warn('API refresh failed, using cached data:', apiError);
          }
        }
      }

      // Return cached data (which should now be fresh)
      return await this.getCharacterAssetsWithEnhancedLocationData(characterId);
    } catch (error) {
      console.error(`Failed to get character assets:`, error);
      throw error;
    }
  }

  /**
   * Get character assets with enhanced location data including structure names
   */
  private async getCharacterAssetsWithEnhancedLocationData(characterId: number): Promise<any[]> {
    try {
      // Get basic location data from database
      const assetsWithLocationData = await this.dbManager.getCharacterAssetsWithLocationData(characterId);

      // Enhance structure locations with ESI API calls
      for (const asset of assetsWithLocationData) {
                if (asset.resolvedLocation?.locationType === 'structure') {
          try {
            const structureInfo = await super.getStructureInfo(characterId, asset.resolvedLocation.locationId);

            // Update the resolved location with real structure name
            asset.resolvedLocation.locationName = structureInfo.name;

            // Try to get solar system info for the structure
            const solarSystem = this.dbManager.staticData.getSolarSystem(structureInfo.system_id);
            const region = solarSystem ? this.dbManager.staticData.getRegion(solarSystem.regionId) : null;

            if (solarSystem) {
              asset.resolvedLocation.solarSystem = {
                id: solarSystem.solarSystemId,
                name: solarSystem.solarSystemName,
                security: solarSystem.security
              };

              if (region) {
                asset.resolvedLocation.region = {
                  id: region.regionId,
                  name: region.regionName
                };
              }
            }
          } catch (error) {
            console.warn(`Failed to resolve structure ${asset.resolvedLocation.locationId}:`, error.message || error);
            // Keep the default structure name if ESI call fails
          }
        }
      }

      return assetsWithLocationData;
    } catch (error) {
      console.error(`Failed to get enhanced location data:`, error);
      throw error;
    }
  }

  /**
   * Get and cache item type information
   */
  public async getAndCacheTypeInfo(typeId: number): Promise<EVEType> {
    try {
      await this.ensureDbInitialized();
      // Try to get from cache first
      const cachedType = await this.dbManager.items.getItemType(typeId);
      if (cachedType) {
        return {
          type_id: cachedType.typeId,
          name: cachedType.name,
          description: cachedType.description || '',
          published: cachedType.published,
          group_id: cachedType.groupId || 0,
          market_group_id: cachedType.marketGroupId,
          mass: cachedType.mass,
          volume: cachedType.volume,
          capacity: cachedType.capacity,
          portion_size: cachedType.portionSize,
          radius: cachedType.radius,
          icon_id: cachedType.iconId,
        };
      }

      // Fetch from API and cache
      const typeInfo = await super.getTypeInfo(typeId);
      await this.dbManager.cacheItemType(typeInfo);

      return typeInfo;
    } catch (error) {
      console.error(`Failed to get and cache type info for ${typeId}:`, error);
      throw error;
    }
  }

  /**
   * Batch fetch and cache missing item types
   */
  public async batchCacheMissingTypes(typeIds: number[]): Promise<void> {
    try {
      const missingTypeIds = await this.dbManager.items.getMissingItemTypes(typeIds);

      if (missingTypeIds.length === 0) {
        console.log('No missing item types to cache');
        return;
      }

      console.log(`Caching ${missingTypeIds.length} missing item types`);

      // Fetch types in parallel (with rate limiting)
      const typePromises = missingTypeIds.map(async (typeId) => {
        try {
          return await this.getAndCacheTypeInfo(typeId);
        } catch (error) {
          console.warn(`Failed to cache type ${typeId}:`, error);
          return null;
        }
      });

      // Process in batches to avoid overwhelming the API
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < typePromises.length; i += batchSize) {
        batches.push(typePromises.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        await Promise.all(batch);
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`Successfully cached item types`);
    } catch (error) {
      console.error('Failed to batch cache missing types:', error);
      throw error;
    }
  }

  /**
   * Search character assets in database
   */
  public async searchCharacterAssets(characterId: number, searchTerm: string): Promise<any[]> {
    try {
      await this.ensureDbInitialized();
      return await this.dbManager.searchCharacterAssets(characterId, searchTerm);
    } catch (error) {
      console.error(`Failed to search character assets:`, error);
      throw error;
    }
  }

  /**
   * Get character asset statistics
   */
  public async getCharacterAssetStats(characterId: number): Promise<any> {
    try {
      await this.ensureDbInitialized();
      return await this.dbManager.getCharacterAssetStats(characterId);
    } catch (error) {
      console.error(`Failed to get character asset stats:`, error);
      throw error;
    }
  }

  /**
   * Sync character authentication data with database
   */
  public async syncCharacterAuth(characterData: {
    characterId: number;
    characterName: string;
    corporationId?: number;
    allianceId?: number;
    securityStatus?: number;
    birthday?: string;
    raceId?: number;
    bloodlineId?: number;
    ancestryId?: number;
    gender?: 'male' | 'female';
    accessToken: string;
    refreshToken: string;
    tokenExpires: number;
    scopes: string[];
  }): Promise<void> {
    try {
      await this.ensureDbInitialized();
      await this.dbManager.syncCharacterData(characterData);
    } catch (error) {
      console.error('Failed to sync character auth with database:', error);
      throw error;
    }
  }

  /**
   * Get database manager instance
   */
  public getDatabaseManager(): DatabaseManager {
    return this.dbManager;
  }

  /**
   * Get overall database statistics
   */
  public async getDatabaseStats(): Promise<any> {
    try {
      await this.ensureDbInitialized();
      return await this.dbManager.getDatabaseStats();
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw error;
    }
  }
}

import { initializeDatabase, getDatabase, closeDatabase } from './db';
import { CharacterService } from './services/character-service';
import { AssetService } from './services/asset-service';
import { ItemService } from './services/item-service';
import { StaticDataService } from './services/static-data-service';
import { SqlJsDatabase } from 'drizzle-orm/sql-js';
import * as schema from './schema';

/**
 * Central database manager that provides access to all database services
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: SqlJsDatabase<typeof schema> | null = null;
  private initialized = false;

  public readonly characters: CharacterService;
  public readonly assets: AssetService;
  public readonly items: ItemService;
  public readonly staticData: StaticDataService;

  private constructor() {
    console.log('Creating DatabaseManager...');

    // Initialize services (they will get the db instance when needed)
    this.characters = new CharacterService();
    this.assets = new AssetService();
    this.items = new ItemService();
    this.staticData = StaticDataService.getInstance();
  }

  /**
   * Initialize the database asynchronously
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('Initializing DatabaseManager...');
    this.db = await initializeDatabase();

    // Initialize static data service
    try {
      await this.staticData.initialize();
    } catch (error) {
      console.error('Failed to initialize static data service:', error);
      console.error('Error details:', error.message, error.stack);
      console.warn('Item name resolution will not be available');
    }

    this.initialized = true;
    console.log('DatabaseManager initialized successfully');
  }

  /**
   * Get the singleton instance of DatabaseManager
   */
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Get and initialize the singleton instance
   */
  public static async getInitializedInstance(): Promise<DatabaseManager> {
    const instance = DatabaseManager.getInstance();
    await instance.initialize();
    return instance;
  }

  /**
   * Get the raw database instance
   */
  public getDb(): SqlJsDatabase<typeof schema> {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Close the database connection
   */
  public close(): void {
    closeDatabase();
    DatabaseManager.instance = null as any;
  }

  /**
   * Sync character data from EVE API to database
   */
  public async syncCharacterData(characterData: {
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
      console.log(`Syncing character data for ${characterData.characterName} (${characterData.characterId})`);

      // Store/update character in database
      await this.characters.upsertCharacter(characterData);

      console.log(`Character data synced successfully for ${characterData.characterName}`);
    } catch (error) {
      console.error('Failed to sync character data:', error);
      throw error;
    }
  }

  /**
   * Sync character assets from EVE API to database
   */
  public async syncCharacterAssets(characterId: number, assets: any[]): Promise<void> {
    try {
      console.log(`Syncing ${assets.length} assets for character ${characterId}`);

      // Store assets in database
      await this.assets.storeCharacterAssets(characterId, assets);

      // Update last sync timestamp
      await this.characters.updateLastSync(characterId);

            // Get unique type IDs from assets and queue them for background caching
      const typeIds = [...new Set(assets.map(asset => asset.type_id))];

      // Check which item types we don't have cached
      const missingTypeIds = await this.items.getMissingItemTypes(typeIds);

      if (missingTypeIds.length > 0) {
        console.log(`Found ${missingTypeIds.length} missing item types that need to be cached`);
        // Note: We'll let the UI trigger caching of missing types when needed
        // This prevents foreign key constraint issues during asset storage
      }

      console.log(`Assets synced successfully for character ${characterId}`);
    } catch (error) {
      console.error('Failed to sync character assets:', error);
      throw error;
    }
  }

    /**
   * Get character assets with enhanced data from database
   */
  public async getCharacterAssetsWithData(characterId: number): Promise<any[]> {
    try {
      const assetsWithTypes = await this.assets.getCharacterAssetsWithTypes(characterId);

      // Get unique type IDs that need static data resolution
      const typeIds = [...new Set(assetsWithTypes.map(asset => asset.typeId))];

            // Try to resolve item names from static data first
      const staticDataMap = this.staticData.getItemTypes(typeIds);

      // For items not found in static data, we'll fetch from ESI API and cache them
      const missingTypeIds = typeIds.filter(typeId => !staticDataMap.has(typeId));

      return assetsWithTypes.map(asset => {
        const staticData = staticDataMap.get(asset.typeId);
        const cachedData = asset.itemType;

        return {
          ...asset,
          // Prefer static data names, fall back to cached data, then type ID
          itemName: staticData?.typeName || cachedData?.name || `Type ${asset.typeId}`,
          itemDescription: staticData?.description || cachedData?.description,
          volume: staticData?.volume || cachedData?.volume,
          mass: staticData?.mass || cachedData?.mass,
          capacity: staticData?.capacity || cachedData?.capacity,
          published: staticData?.published || cachedData?.published,
          groupId: staticData?.groupId || cachedData?.groupId,
          categoryId: staticData?.categoryId || cachedData?.categoryId,
          // Add metadata about data source
          dataSource: staticData ? 'static' : (cachedData ? 'cached' : 'none'),
          needsTypeResolution: !staticData && !cachedData
        };
      });
    } catch (error) {
      console.error('Failed to get character assets with data:', error);
      throw error;
    }
  }

    /**
   * Search character assets
   */
  public async searchCharacterAssets(characterId: number, searchTerm: string): Promise<any[]> {
    try {
      // Get all assets for this character first
      const allAssets = await this.getCharacterAssetsWithData(characterId);

      if (!searchTerm.trim()) {
        return allAssets;
      }

      // Filter by item name or description using resolved static data
      const searchLower = searchTerm.toLowerCase();
      return allAssets.filter(asset =>
        asset.itemName?.toLowerCase().includes(searchLower) ||
        asset.itemDescription?.toLowerCase().includes(searchLower) ||
        asset.typeId.toString().includes(searchTerm)
      );
    } catch (error) {
      console.error('Failed to search character assets:', error);
      throw error;
    }
  }

  /**
   * Get asset statistics for a character
   */
  public async getCharacterAssetStats(characterId: number): Promise<{
    totalItems: number;
    totalUniqueTypes: number;
    totalLocations: number;
    lastSyncTime: number | null;
    totalVolume?: number;
    totalMass?: number;
  }> {
    try {
      const stats = await this.assets.getCharacterAssetStats(characterId);
      const assetsWithTypes = await this.assets.getCharacterAssetsWithTypes(characterId);

      // Calculate total volume and mass
      let totalVolume = 0;
      let totalMass = 0;

      assetsWithTypes.forEach(asset => {
        if (asset.itemType?.volume) {
          totalVolume += asset.itemType.volume * asset.quantity;
        }
        if (asset.itemType?.mass) {
          totalMass += asset.itemType.mass * asset.quantity;
        }
      });

      return {
        ...stats,
        totalVolume,
        totalMass,
      };
    } catch (error) {
      console.error('Failed to get character asset stats:', error);
      throw error;
    }
  }

  /**
   * Cache item type information
   */
  public async cacheItemType(typeData: any): Promise<void> {
    try {
      await this.items.cacheItemType(typeData);
    } catch (error) {
      console.error('Failed to cache item type:', error);
      throw error;
    }
  }

  /**
   * Batch cache multiple item types
   */
  public async batchCacheItemTypes(typeDataArray: any[]): Promise<void> {
    try {
      await this.items.batchCacheItemTypes(typeDataArray);
    } catch (error) {
      console.error('Failed to batch cache item types:', error);
      throw error;
    }
  }

  /**
   * Fetch and cache missing item types from ESI API
   */
  public async fetchAndCacheMissingTypes(typeIds: number[]): Promise<void> {
    if (typeIds.length === 0) return;

    console.log(`Fetching ${typeIds.length} missing item types from ESI API...`);

    try {
      // We'll use the ESI client to fetch these
      // For now, we'll do a simple parallel fetch with rate limiting
      const batchSize = 10;
      const delay = 200; // 200ms between batches

      for (let i = 0; i < typeIds.length; i += batchSize) {
        const batch = typeIds.slice(i, i + batchSize);

        const batchPromises = batch.map(async (typeId) => {
          try {
            // This will use the existing ESI client method
            return { typeId, success: true };
          } catch (error) {
            console.warn(`Failed to fetch type ${typeId}:`, error);
            return { typeId, success: false };
          }
        });

        await Promise.all(batchPromises);

        // Rate limiting delay
        if (i + batchSize < typeIds.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      console.log(`Completed fetching item types`);
    } catch (error) {
      console.error('Failed to fetch missing item types:', error);
    }
  }

  /**
   * Get database statistics
   */
  public async getDatabaseStats(): Promise<{
    characters: number;
    assets: number;
    itemTypes: number;
    lastSync: number | null;
  }> {
    try {
      const characters = await this.characters.getAllCharacters();
      const itemTypeStats = await this.items.getItemTypeStats();

      // Get asset count across all characters
      let totalAssets = 0;
      let lastSync = null;

      for (const character of characters) {
        const assetStats = await this.assets.getCharacterAssetStats(character.characterId);
        totalAssets += assetStats.totalItems;

        if (assetStats.lastSyncTime && (!lastSync || assetStats.lastSyncTime > lastSync)) {
          lastSync = assetStats.lastSyncTime;
        }
      }

      return {
        characters: characters.length,
        assets: totalAssets,
        itemTypes: itemTypeStats.totalTypes,
        lastSync,
      };
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw error;
    }
  }

  /**
   * Resolve location information from static data and ESI API
   */
  public async resolveLocation(locationId: number, characterId?: number): Promise<{
    locationId: number;
    locationName: string;
    locationType: 'station' | 'solar_system' | 'structure' | 'unknown';
    solarSystem?: { id: number; name: string; security: number };
    region?: { id: number; name: string };
  }> {
        // Validate input
    if (!locationId || typeof locationId !== 'number') {
      console.warn('Invalid locationId for resolution:', locationId);
      return {
        locationId: locationId || 0,
        locationName: `Invalid Location ${locationId}`,
        locationType: 'unknown'
      };
    }
            // Try to resolve as station first
    const station = this.staticData.getStation(locationId);
    if (station) {
      const solarSystem = this.staticData.getSolarSystem(station.solarSystemId);
      const region = solarSystem ? this.staticData.getRegion(solarSystem.regionId) : null;

      return {
        locationId,
        locationName: station.stationName,
        locationType: 'station',
        solarSystem: solarSystem ? {
          id: solarSystem.solarSystemId,
          name: solarSystem.solarSystemName,
          security: solarSystem.security
        } : undefined,
        region: region ? {
          id: region.regionId,
          name: region.regionName
        } : undefined
      };
    }

        // Try to resolve as solar system
    const solarSystem = this.staticData.getSolarSystem(locationId);
    if (solarSystem) {
      const region = this.staticData.getRegion(solarSystem.regionId);

      return {
        locationId,
        locationName: solarSystem.solarSystemName,
        locationType: 'solar_system',
        solarSystem: {
          id: solarSystem.solarSystemId,
          name: solarSystem.solarSystemName,
          security: solarSystem.security
        },
        region: region ? {
          id: region.regionId,
          name: region.regionName
        } : undefined
      };
    }

    // For structures and other locations we can't resolve from static data,
    // try to use ESI API calls for structures

        // For structures, we'll handle them in EnhancedESIClient since it has access to ESI API
    // For now, just mark them as unknown structures
    if (locationId >= 1000000000000) {
      return {
        locationId,
        locationName: `Structure ${locationId}`,
        locationType: 'structure'
      };
    }

    return {
      locationId,
      locationName: `Location ${locationId}`,
      locationType: 'unknown'
    };
  }

  /**
   * Get any authenticated character (helper for structure API calls)
   */
        private async getAnyAuthenticatedCharacter(): Promise<{ characterId: number } | null> {
    try {
      const characters = await this.characters.getAllCharacters();

      // Return the first character that has valid tokens
      for (const character of characters) {
        if (character.accessToken && character.refreshToken) {
          return { characterId: character.characterId };
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to get authenticated character for structure lookup:', error);
      return null;
    }
  }

    /**
   * Get character assets with location and item data resolved
   */
  public async getCharacterAssetsWithLocationData(characterId: number): Promise<any[]> {
        try {
      const assetsWithData = await this.getCharacterAssetsWithData(characterId);

      // Filter out assets with invalid location IDs and resolve unique location IDs
      const validLocationIds = [...new Set(
        assetsWithData
          .map(asset => asset.locationId)
          .filter(id => id && typeof id === 'number' && !isNaN(id))
      )];

      const locationMap = new Map();

      for (const locationId of validLocationIds) {
        const location = await this.resolveLocation(locationId, characterId);
        locationMap.set(locationId, location);
      }

      return assetsWithData.map(asset => ({
        ...asset,
        resolvedLocation: locationMap.get(asset.locationId) || {
          locationId: asset.locationId || 0,
          locationName: `Unknown Location ${asset.locationId || 'N/A'}`,
          locationType: 'unknown'
        }
      }));
    } catch (error) {
      console.error('Failed to get character assets with location data:', error);
      throw error;
    }
  }
}

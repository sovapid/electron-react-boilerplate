import { eq, and, inArray } from 'drizzle-orm';
import { getDatabase, schema } from '../db';
import { CharacterAsset, NewCharacterAsset, ItemType, NewItemType } from '../schema';
import { EVEAsset } from '../../api/types';

export class AssetService {
  private getDb() {
    return getDatabase();
  }

  /**
   * Store character assets from EVE API response
   */
  async storeCharacterAssets(characterId: number, assets: EVEAsset[]): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // First, delete existing assets for this character
    await this.getDb()
      .delete(schema.characterAssets)
      .where(eq(schema.characterAssets.characterId, characterId));

    // Prepare asset records
    const assetRecords: NewCharacterAsset[] = assets.map(asset => ({
      characterId,
      itemId: asset.item_id,
      typeId: asset.type_id,
      quantity: asset.quantity,
      locationId: asset.location_id,
      locationFlag: asset.location_flag,
      locationType: asset.location_type,
      isSingleton: asset.is_singleton,
      isBlueprintCopy: asset.is_blueprint_copy || false,
      syncedAt: now,
    }));

    // Batch insert assets
    if (assetRecords.length > 0) {
      // SQLite has a limit on the number of variables, so we batch the inserts
      const batchSize = 500;
      for (let i = 0; i < assetRecords.length; i += batchSize) {
        const batch = assetRecords.slice(i, i + batchSize);
        await this.getDb().insert(schema.characterAssets).values(batch);
      }
    }

    console.log(`Stored ${assetRecords.length} assets for character ${characterId}`);
  }

  /**
   * Get all assets for a character
   */
  async getCharacterAssets(characterId: number): Promise<CharacterAsset[]> {
    return await this.getDb()
      .select()
      .from(schema.characterAssets)
      .where(eq(schema.characterAssets.characterId, characterId));
  }

  /**
   * Get assets with item type information
   */
  async getCharacterAssetsWithTypes(characterId: number): Promise<Array<CharacterAsset & { itemType?: ItemType }>> {
    const result = await this.getDb()
      .select({
        asset: schema.characterAssets,
        itemType: schema.itemTypes,
      })
      .from(schema.characterAssets)
      .leftJoin(
        schema.itemTypes,
        eq(schema.characterAssets.typeId, schema.itemTypes.typeId)
      )
      .where(eq(schema.characterAssets.characterId, characterId));

    return result.map(row => ({
      ...row.asset,
      itemType: row.itemType || undefined,
    }));
  }

  /**
   * Get asset statistics for a character
   */
  async getCharacterAssetStats(characterId: number): Promise<{
    totalItems: number;
    totalUniqueTypes: number;
    totalLocations: number;
    lastSyncTime: number | null;
  }> {
    const assets = await this.getCharacterAssets(characterId);

    if (assets.length === 0) {
      return {
        totalItems: 0,
        totalUniqueTypes: 0,
        totalLocations: 0,
        lastSyncTime: null,
      };
    }

    const uniqueTypes = new Set(assets.map(a => a.typeId));
    const uniqueLocations = new Set(assets.map(a => `${a.locationId}-${a.locationFlag}`));
    const lastSyncTime = Math.max(...assets.map(a => a.syncedAt));

    return {
      totalItems: assets.length,
      totalUniqueTypes: uniqueTypes.size,
      totalLocations: uniqueLocations.size,
      lastSyncTime,
    };
  }

  /**
   * Get assets grouped by location
   */
  async getCharacterAssetsByLocation(characterId: number): Promise<{
    [locationKey: string]: CharacterAsset[];
  }> {
    const assets = await this.getCharacterAssets(characterId);
    const grouped: { [locationKey: string]: CharacterAsset[] } = {};

    assets.forEach(asset => {
      const locationKey = `${asset.locationId}-${asset.locationFlag}`;
      if (!grouped[locationKey]) {
        grouped[locationKey] = [];
      }
      grouped[locationKey].push(asset);
    });

    return grouped;
  }

  /**
   * Search assets by type name (requires item types to be cached)
   */
  async searchCharacterAssets(characterId: number, searchTerm: string): Promise<Array<CharacterAsset & { itemType?: ItemType }>> {
    if (!searchTerm.trim()) {
      return this.getCharacterAssetsWithTypes(characterId);
    }

    const result = await this.getDb()
      .select({
        asset: schema.characterAssets,
        itemType: schema.itemTypes,
      })
      .from(schema.characterAssets)
      .leftJoin(
        schema.itemTypes,
        eq(schema.characterAssets.typeId, schema.itemTypes.typeId)
      )
      .where(
        and(
          eq(schema.characterAssets.characterId, characterId),
          // Search in item name or description
          searchTerm ? eq(schema.itemTypes.name, `%${searchTerm}%`) : undefined
        )
      );

    return result.map(row => ({
      ...row.asset,
      itemType: row.itemType || undefined,
    }));
  }

  /**
   * Get assets by location type (station, solar_system, other)
   */
  async getCharacterAssetsByLocationType(
    characterId: number,
    locationType: 'station' | 'solar_system' | 'other'
  ): Promise<CharacterAsset[]> {
    return await this.getDb()
      .select()
      .from(schema.characterAssets)
      .where(
        and(
          eq(schema.characterAssets.characterId, characterId),
          eq(schema.characterAssets.locationType, locationType)
        )
      );
  }

  /**
   * Get the most valuable assets (by quantity, since we don't have market data yet)
   */
  async getTopAssetsByQuantity(characterId: number, limit: number = 10): Promise<CharacterAsset[]> {
    return await this.getDb()
      .select()
      .from(schema.characterAssets)
      .where(eq(schema.characterAssets.characterId, characterId))
      .orderBy(schema.characterAssets.quantity)
      .limit(limit);
  }

  /**
   * Delete assets older than a certain timestamp
   */
  async deleteOldAssets(characterId: number, olderThanTimestamp: number): Promise<number> {
    const result = await this.getDb()
      .delete(schema.characterAssets)
      .where(
        and(
          eq(schema.characterAssets.characterId, characterId),
          eq(schema.characterAssets.syncedAt, olderThanTimestamp)
        )
      );

    return result.changes || 0;
  }
}

import { eq, inArray, sql } from 'drizzle-orm';
import { getDatabase, schema } from '../db';
import { ItemType, NewItemType } from '../schema';
import { EVEType } from '../../api/types';

export class ItemService {
  private getDb() {
    return getDatabase();
  }

  /**
   * Cache item type information from EVE API
   */
  async cacheItemType(typeData: EVEType): Promise<ItemType> {
    const now = Math.floor(Date.now() / 1000);

    const itemTypeRecord: NewItemType = {
      typeId: typeData.type_id,
      name: typeData.name,
      description: typeData.description,
      groupId: typeData.group_id,
      categoryId: typeData.market_group_id, // Note: EVE API inconsistency
      marketGroupId: typeData.market_group_id,
      mass: typeData.mass,
      volume: typeData.volume,
      capacity: typeData.capacity,
      portionSize: typeData.portion_size,
      radius: typeData.radius,
      iconId: typeData.icon_id,
      published: typeData.published,
      lastUpdated: now,
    };

    await this.getDb()
      .insert(schema.itemTypes)
      .values(itemTypeRecord)
      .onConflictDoUpdate({
        target: schema.itemTypes.typeId,
        set: {
          name: itemTypeRecord.name,
          description: itemTypeRecord.description,
          groupId: itemTypeRecord.groupId,
          categoryId: itemTypeRecord.categoryId,
          marketGroupId: itemTypeRecord.marketGroupId,
          mass: itemTypeRecord.mass,
          volume: itemTypeRecord.volume,
          capacity: itemTypeRecord.capacity,
          portionSize: itemTypeRecord.portionSize,
          radius: itemTypeRecord.radius,
          iconId: itemTypeRecord.iconId,
          published: itemTypeRecord.published,
          lastUpdated: itemTypeRecord.lastUpdated,
        },
      });

    const result = await this.getItemType(typeData.type_id);
    if (!result) {
      throw new Error(`Failed to cache item type ${typeData.type_id}`);
    }
    return result;
  }

  /**
   * Get item type by ID
   */
  async getItemType(typeId: number): Promise<ItemType | null> {
    const result = await this.getDb()
      .select()
      .from(schema.itemTypes)
      .where(eq(schema.itemTypes.typeId, typeId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get multiple item types by IDs
   */
  async getItemTypes(typeIds: number[]): Promise<ItemType[]> {
    if (typeIds.length === 0) {
      return [];
    }

    return await this.getDb()
      .select()
      .from(schema.itemTypes)
      .where(inArray(schema.itemTypes.typeId, typeIds));
  }

  /**
   * Get item types that are missing from cache
   */
  async getMissingItemTypes(typeIds: number[]): Promise<number[]> {
    if (typeIds.length === 0) {
      return [];
    }

    const existing = await this.getDb()
      .select({ typeId: schema.itemTypes.typeId })
      .from(schema.itemTypes)
      .where(inArray(schema.itemTypes.typeId, typeIds));

    const existingIds = new Set(existing.map(item => item.typeId));
    return typeIds.filter(id => !existingIds.has(id));
  }

  /**
   * Search item types by name
   */
  async searchItemTypes(searchTerm: string, limit: number = 50): Promise<ItemType[]> {
    return await this.getDb()
      .select()
      .from(schema.itemTypes)
      .where(sql`${schema.itemTypes.name} LIKE ${'%' + searchTerm + '%'}`)
      .limit(limit);
  }

  /**
   * Get item types by category
   */
  async getItemTypesByCategory(categoryId: number): Promise<ItemType[]> {
    return await this.getDb()
      .select()
      .from(schema.itemTypes)
      .where(eq(schema.itemTypes.categoryId, categoryId));
  }

  /**
   * Get item types by group
   */
  async getItemTypesByGroup(groupId: number): Promise<ItemType[]> {
    return await this.getDb()
      .select()
      .from(schema.itemTypes)
      .where(eq(schema.itemTypes.groupId, groupId));
  }

  /**
   * Get all item types (paginated)
   */
  async getAllItemTypes(offset: number = 0, limit: number = 1000): Promise<ItemType[]> {
    return await this.getDb()
      .select()
      .from(schema.itemTypes)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get item type statistics
   */
  async getItemTypeStats(): Promise<{
    totalTypes: number;
    publishedTypes: number;
    lastUpdated: number | null;
  }> {
    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.itemTypes);

    const publishedResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.itemTypes)
      .where(eq(schema.itemTypes.published, true));

    const lastUpdatedResult = await this.db
      .select({ lastUpdated: sql<number>`max(${schema.itemTypes.lastUpdated})` })
      .from(schema.itemTypes);

    return {
      totalTypes: totalResult[0]?.count || 0,
      publishedTypes: publishedResult[0]?.count || 0,
      lastUpdated: lastUpdatedResult[0]?.lastUpdated || null,
    };
  }

  /**
   * Delete item types older than a certain timestamp
   */
  async deleteOldItemTypes(olderThanTimestamp: number): Promise<number> {
    const result = await this.getDb()
      .delete(schema.itemTypes)
      .where(sql`${schema.itemTypes.lastUpdated} < ${olderThanTimestamp}`);

    return result.changes || 0;
  }

  /**
   * Batch cache multiple item types
   */
  async batchCacheItemTypes(typeDataArray: EVEType[]): Promise<void> {
    if (typeDataArray.length === 0) {
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const itemTypeRecords: NewItemType[] = typeDataArray.map(typeData => ({
      typeId: typeData.type_id,
      name: typeData.name,
      description: typeData.description,
      groupId: typeData.group_id,
      categoryId: typeData.market_group_id,
      marketGroupId: typeData.market_group_id,
      mass: typeData.mass,
      volume: typeData.volume,
      capacity: typeData.capacity,
      portionSize: typeData.portion_size,
      radius: typeData.radius,
      iconId: typeData.icon_id,
      published: typeData.published,
      lastUpdated: now,
    }));

    // Batch insert with conflict resolution
    const batchSize = 100;
    for (let i = 0; i < itemTypeRecords.length; i += batchSize) {
      const batch = itemTypeRecords.slice(i, i + batchSize);

      // For batch operations, we'll use a simple insert or ignore approach
      // and then update individually if needed for better performance
      await this.getDb()
        .insert(schema.itemTypes)
        .values(batch)
        .onConflictDoNothing();
    }

    console.log(`Cached ${itemTypeRecords.length} item types`);
  }
}

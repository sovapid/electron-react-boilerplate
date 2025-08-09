import { sqliteTable, integer, text, real, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Characters table - stores authenticated EVE characters
export const characters = sqliteTable('characters', {
  characterId: integer('character_id').primaryKey(),
  characterName: text('character_name').notNull(),
  corporationId: integer('corporation_id'),
  allianceId: integer('alliance_id'),
  securityStatus: real('security_status'),
  birthday: text('birthday'), // ISO date string
  raceId: integer('race_id'),
  bloodlineId: integer('bloodline_id'),
  ancestryId: integer('ancestry_id'),
  gender: text('gender', { enum: ['male', 'female'] }),

  // Authentication data
  accessToken: blob('access_token'), // encrypted
  refreshToken: blob('refresh_token'), // encrypted
  tokenExpires: integer('token_expires').notNull(),
  scopes: text('scopes').notNull(), // JSON array of granted scopes

  // Metadata
  lastSync: integer('last_sync'), // timestamp of last inventory sync
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
});

// Item types cache - stores EVE item type information
export const itemTypes = sqliteTable('item_types', {
  typeId: integer('type_id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  groupId: integer('group_id'),
  categoryId: integer('category_id'),
  marketGroupId: integer('market_group_id'),
  mass: real('mass'),
  volume: real('volume'),
  capacity: real('capacity'),
  portionSize: integer('portion_size'),
  radius: real('radius'),
  iconId: integer('icon_id'),
  published: integer('published', { mode: 'boolean' }).notNull().default(true),

  // Metadata
  lastUpdated: integer('last_updated').notNull().default(sql`(unixepoch())`),
});

// Character assets - stores individual inventory items
export const characterAssets = sqliteTable('character_assets', {
  // Composite primary key of character_id + item_id
  id: integer('id').primaryKey({ autoIncrement: true }),
  characterId: integer('character_id').notNull().references(() => characters.characterId, { onDelete: 'cascade' }),
  itemId: integer('item_id').notNull(), // EVE's unique item ID
  typeId: integer('type_id').notNull(), // References item_types but no foreign key constraint

  // Asset properties
  quantity: integer('quantity').notNull().default(1),
  locationId: integer('location_id').notNull(),
  locationFlag: text('location_flag').notNull(),
  locationType: text('location_type', { enum: ['station', 'solar_system', 'other'] }).notNull().default('other'),
  isSingleton: integer('is_singleton', { mode: 'boolean' }).notNull().default(false),
  isBlueprintCopy: integer('is_blueprint_copy', { mode: 'boolean' }),

  // Metadata
  syncedAt: integer('synced_at').notNull().default(sql`(unixepoch())`),
});

// Locations cache - stores location names and types
export const locations = sqliteTable('locations', {
  locationId: integer('location_id').primaryKey(),
  name: text('name'),
  type: text('type'), // station, structure, solar_system, region, etc.
  systemId: integer('system_id'),
  regionId: integer('region_id'),

  // Metadata
  lastUpdated: integer('last_updated').notNull().default(sql`(unixepoch())`),
});

// Solar systems cache - for location resolution
export const solarSystems = sqliteTable('solar_systems', {
  systemId: integer('system_id').primaryKey(),
  name: text('name').notNull(),
  regionId: integer('region_id'),
  constellationId: integer('constellation_id'),
  securityStatus: real('security_status'),

  // Metadata
  lastUpdated: integer('last_updated').notNull().default(sql`(unixepoch())`),
});

// Regions cache - for location hierarchy
export const regions = sqliteTable('regions', {
  regionId: integer('region_id').primaryKey(),
  name: text('name').notNull(),

  // Metadata
  lastUpdated: integer('last_updated').notNull().default(sql`(unixepoch())`),
});

// Item groups - for categorization
export const itemGroups = sqliteTable('item_groups', {
  groupId: integer('group_id').primaryKey(),
  name: text('name').notNull(),
  categoryId: integer('category_id').notNull(),
  published: integer('published', { mode: 'boolean' }).notNull().default(true),

  // Metadata
  lastUpdated: integer('last_updated').notNull().default(sql`(unixepoch())`),
});

// Item categories - top-level categorization
export const itemCategories = sqliteTable('item_categories', {
  categoryId: integer('category_id').primaryKey(),
  name: text('name').notNull(),
  published: integer('published', { mode: 'boolean' }).notNull().default(true),

  // Metadata
  lastUpdated: integer('last_updated').notNull().default(sql`(unixepoch())`),
});

// Export types for use in the application
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

export type ItemType = typeof itemTypes.$inferSelect;
export type NewItemType = typeof itemTypes.$inferInsert;

export type CharacterAsset = typeof characterAssets.$inferSelect;
export type NewCharacterAsset = typeof characterAssets.$inferInsert;

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

export type SolarSystem = typeof solarSystems.$inferSelect;
export type NewSolarSystem = typeof solarSystems.$inferInsert;

export type Region = typeof regions.$inferSelect;
export type NewRegion = typeof regions.$inferInsert;

export type ItemGroup = typeof itemGroups.$inferSelect;
export type NewItemGroup = typeof itemGroups.$inferInsert;

export type ItemCategory = typeof itemCategories.$inferSelect;
export type NewItemCategory = typeof itemCategories.$inferInsert;

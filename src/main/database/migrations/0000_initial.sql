-- Initial database schema for EVE Online Inventory Manager

-- Characters table
CREATE TABLE `characters` (
  `character_id` integer PRIMARY KEY NOT NULL,
  `character_name` text NOT NULL,
  `corporation_id` integer,
  `alliance_id` integer,
  `security_status` real,
  `birthday` text,
  `race_id` integer,
  `bloodline_id` integer,
  `ancestry_id` integer,
  `gender` text,
  `access_token` blob,
  `refresh_token` blob,
  `token_expires` integer NOT NULL,
  `scopes` text NOT NULL,
  `last_sync` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

-- Item types cache
CREATE TABLE `item_types` (
  `type_id` integer PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `group_id` integer,
  `category_id` integer,
  `market_group_id` integer,
  `mass` real,
  `volume` real,
  `capacity` real,
  `portion_size` integer,
  `radius` real,
  `icon_id` integer,
  `published` integer DEFAULT 1 NOT NULL,
  `last_updated` integer DEFAULT (unixepoch()) NOT NULL
);

-- Character assets
CREATE TABLE `character_assets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `character_id` integer NOT NULL,
  `item_id` integer NOT NULL,
  `type_id` integer NOT NULL,
  `quantity` integer DEFAULT 1 NOT NULL,
  `location_id` integer NOT NULL,
  `location_flag` text NOT NULL,
  `location_type` text DEFAULT 'other' NOT NULL,
  `is_singleton` integer DEFAULT 0 NOT NULL,
  `is_blueprint_copy` integer,
  `synced_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`character_id`) REFERENCES `characters`(`character_id`) ON DELETE cascade,
  FOREIGN KEY (`type_id`) REFERENCES `item_types`(`type_id`)
);

-- Locations cache
CREATE TABLE `locations` (
  `location_id` integer PRIMARY KEY NOT NULL,
  `name` text,
  `type` text,
  `system_id` integer,
  `region_id` integer,
  `last_updated` integer DEFAULT (unixepoch()) NOT NULL
);

-- Solar systems cache
CREATE TABLE `solar_systems` (
  `system_id` integer PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `region_id` integer,
  `constellation_id` integer,
  `security_status` real,
  `last_updated` integer DEFAULT (unixepoch()) NOT NULL
);

-- Regions cache
CREATE TABLE `regions` (
  `region_id` integer PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `last_updated` integer DEFAULT (unixepoch()) NOT NULL
);

-- Item groups
CREATE TABLE `item_groups` (
  `group_id` integer PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `category_id` integer NOT NULL,
  `published` integer DEFAULT 1 NOT NULL,
  `last_updated` integer DEFAULT (unixepoch()) NOT NULL
);

-- Item categories
CREATE TABLE `item_categories` (
  `category_id` integer PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `published` integer DEFAULT 1 NOT NULL,
  `last_updated` integer DEFAULT (unixepoch()) NOT NULL
);

-- Indexes for better performance
CREATE INDEX `idx_character_assets_character_id` ON `character_assets` (`character_id`);
CREATE INDEX `idx_character_assets_type_id` ON `character_assets` (`type_id`);
CREATE INDEX `idx_character_assets_location_id` ON `character_assets` (`location_id`);
CREATE INDEX `idx_character_assets_synced_at` ON `character_assets` (`synced_at`);

CREATE INDEX `idx_item_types_name` ON `item_types` (`name`);
CREATE INDEX `idx_item_types_group_id` ON `item_types` (`group_id`);
CREATE INDEX `idx_item_types_category_id` ON `item_types` (`category_id`);
CREATE INDEX `idx_item_types_published` ON `item_types` (`published`);

CREATE INDEX `idx_locations_system_id` ON `locations` (`system_id`);
CREATE INDEX `idx_locations_region_id` ON `locations` (`region_id`);

CREATE INDEX `idx_solar_systems_region_id` ON `solar_systems` (`region_id`);

-- Unique constraints
CREATE UNIQUE INDEX `idx_character_assets_character_item` ON `character_assets` (`character_id`, `item_id`);

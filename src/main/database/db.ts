import initSqlJs, { Database } from 'sql.js';
import { drizzle, SqlJsDatabase } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/sql-js/migrator';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';

let db: SqlJsDatabase<typeof schema> | null = null;
let sqlJs: any = null;
let sqlite: Database | null = null;

/**
 * Get the database file path
 */
function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'database');

  // Ensure database directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  return path.join(dbDir, 'eve-inventory.db');
}

/**
 * Initialize the database connection
 */
export async function initializeDatabase(): Promise<SqlJsDatabase<typeof schema>> {
  if (db) {
    return db;
  }

  const dbPath = getDatabasePath();
  console.log('Initializing database at:', dbPath);

  // Initialize sql.js
  if (!sqlJs) {
    sqlJs = await initSqlJs({
      // You can specify a custom wasm file path if needed
      // locateFile: file => `path/to/${file}`
    });
  }

  // Check if we need to reset the database due to schema changes
  const needsReset = await checkIfDatabaseNeedsReset(dbPath);

  // Load existing database file or create new one
  let dbData: Uint8Array | undefined;
  if (fs.existsSync(dbPath) && !needsReset) {
    dbData = fs.readFileSync(dbPath);
  } else if (needsReset) {
    console.log('Database schema outdated, recreating database...');
    // Delete the old database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }

  // Create SQLite connection
  sqlite = new sqlJs.Database(dbData);

  // Disable foreign keys temporarily to avoid constraint issues during development
  sqlite.exec('PRAGMA foreign_keys = OFF');

  // Create Drizzle instance
  db = drizzle(sqlite, { schema });

  // Run migrations
  try {
    console.log('Running database migrations...');
    // For sql.js, we'll run the schema creation directly
    await runInitialMigration(sqlite);
    console.log('Database migrations completed successfully');
  } catch (error) {
    console.error('Database migration failed:', error);
    // If migration fails, create tables manually
    console.log('Attempting to create tables manually...');
    await createTablesManually(sqlite!);
  }

  // Save database to file
  await saveDatabaseToFile();

  return db;
}

/**
 * Get the database instance (must be initialized first)
 */
export function getDatabase(): SqlJsDatabase<typeof schema> {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Save database to file
 */
export async function saveDatabaseToFile(): Promise<void> {
  if (!db || !sqlite) return;

  try {
    const dbPath = getDatabasePath();
    const data = sqlite.export();
    fs.writeFileSync(dbPath, data);
    console.log('Database saved to file');
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    // sql.js databases don't need explicit closing, but we save before cleanup
    saveDatabaseToFile().catch(console.error);
    db = null;
    console.log('Database connection closed');
  }
}

/**
 * Get database statistics
 */
export function getDatabaseStats(): {
  path: string;
  size: number;
  tables: string[];
} {
  const dbPath = getDatabasePath();
  const stats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;

  return {
    path: dbPath,
    size: stats ? stats.size : 0,
    tables: db ? Object.keys(schema) : []
  };
}

/**
 * Vacuum the database to optimize storage
 */
export function vacuumDatabase(): void {
  if (!db) {
    throw new Error('Database not initialized');
  }

  console.log('Vacuuming database...');
  sqlite?.exec('VACUUM');
  saveDatabaseToFile().catch(console.error);
  console.log('Database vacuum completed');
}

/**
 * Reset the database by deleting the file and reinitializing
 */
export async function resetDatabase(): Promise<void> {
  console.log('Resetting database...');

  // Close current connection
  if (db) {
    db = null;
  }
  if (sqlite) {
    sqlite = null;
  }

  // Delete the database file
  const dbPath = getDatabasePath();
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Database file deleted');
  }

  // Reinitialize
  await initializeDatabase();
  console.log('Database reset completed');
}

/**
 * Run initial migration for sql.js
 */
async function runInitialMigration(sqlite: Database): Promise<void> {
  // Read the initial migration file and execute it
  const migrationPath = path.join(__dirname, 'migrations', '0000_initial.sql');

  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    sqlite.exec(migrationSql);
    console.log('Initial migration executed successfully');
  } else {
    console.warn('Initial migration file not found, creating tables manually');
    await createTablesManually(sqlite!);
  }
}

/**
 * Check if database needs to be reset due to schema changes
 */
async function checkIfDatabaseNeedsReset(dbPath: string): Promise<boolean> {
  if (!fs.existsSync(dbPath)) {
    return false; // New database, no reset needed
  }

  try {
    // Try to read the existing database and check for the problematic foreign key
    const existingDbData = fs.readFileSync(dbPath);
    if (!sqlJs) {
      sqlJs = await initSqlJs();
    }

    const testDb = new sqlJs.Database(existingDbData);

    // Check if the character_assets table has the foreign key constraint we want to remove
    const tableInfo = testDb.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='character_assets'");

    if (tableInfo.length > 0 && tableInfo[0].values.length > 0) {
      const createTableSql = tableInfo[0].values[0][0] as string;
      // If the table has the old foreign key constraint, we need to reset
      if (createTableSql.includes('FOREIGN KEY (type_id) REFERENCES item_types(type_id)')) {
        console.log('Found old schema with foreign key constraint, database will be reset');
        testDb.close();
        return true;
      }
    }

    testDb.close();
    return false;
  } catch (error) {
    console.log('Error checking database schema, will reset:', error);
    return true; // If we can't check, reset to be safe
  }
}

/**
 * Create tables manually if migration files don't work
 */
async function createTablesManually(sqlite: Database): Promise<void> {
  console.log('Creating database tables manually...');

  const createTablesSql = `
    -- Characters table
    CREATE TABLE IF NOT EXISTS characters (
      character_id INTEGER PRIMARY KEY NOT NULL,
      character_name TEXT NOT NULL,
      corporation_id INTEGER,
      alliance_id INTEGER,
      security_status REAL,
      birthday TEXT,
      race_id INTEGER,
      bloodline_id INTEGER,
      ancestry_id INTEGER,
      gender TEXT,
      access_token BLOB,
      refresh_token BLOB,
      token_expires INTEGER NOT NULL,
      scopes TEXT NOT NULL,
      last_sync INTEGER,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );

    -- Item types cache
    CREATE TABLE IF NOT EXISTS item_types (
      type_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      group_id INTEGER,
      category_id INTEGER,
      market_group_id INTEGER,
      mass REAL,
      volume REAL,
      capacity REAL,
      portion_size INTEGER,
      radius REAL,
      icon_id INTEGER,
      published INTEGER DEFAULT 1 NOT NULL,
      last_updated INTEGER DEFAULT (unixepoch()) NOT NULL
    );

    -- Character assets
    CREATE TABLE IF NOT EXISTS character_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      character_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      type_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1 NOT NULL,
      location_id INTEGER NOT NULL,
      location_flag TEXT NOT NULL,
      location_type TEXT DEFAULT 'other' NOT NULL,
      is_singleton INTEGER DEFAULT 0 NOT NULL,
      is_blueprint_copy INTEGER,
      synced_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
    );

    -- Locations cache
    CREATE TABLE IF NOT EXISTS locations (
      location_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT,
      type TEXT,
      system_id INTEGER,
      region_id INTEGER,
      last_updated INTEGER DEFAULT (unixepoch()) NOT NULL
    );

    -- Solar systems cache
    CREATE TABLE IF NOT EXISTS solar_systems (
      system_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      region_id INTEGER,
      constellation_id INTEGER,
      security_status REAL,
      last_updated INTEGER DEFAULT (unixepoch()) NOT NULL
    );

    -- Regions cache
    CREATE TABLE IF NOT EXISTS regions (
      region_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      last_updated INTEGER DEFAULT (unixepoch()) NOT NULL
    );

    -- Item groups
    CREATE TABLE IF NOT EXISTS item_groups (
      group_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      published INTEGER DEFAULT 1 NOT NULL,
      last_updated INTEGER DEFAULT (unixepoch()) NOT NULL
    );

    -- Item categories
    CREATE TABLE IF NOT EXISTS item_categories (
      category_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      published INTEGER DEFAULT 1 NOT NULL,
      last_updated INTEGER DEFAULT (unixepoch()) NOT NULL
    );

    -- Indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_character_assets_character_id ON character_assets (character_id);
    CREATE INDEX IF NOT EXISTS idx_character_assets_type_id ON character_assets (type_id);
    CREATE INDEX IF NOT EXISTS idx_character_assets_location_id ON character_assets (location_id);
    CREATE INDEX IF NOT EXISTS idx_character_assets_synced_at ON character_assets (synced_at);

    CREATE INDEX IF NOT EXISTS idx_item_types_name ON item_types (name);
    CREATE INDEX IF NOT EXISTS idx_item_types_group_id ON item_types (group_id);
    CREATE INDEX IF NOT EXISTS idx_item_types_category_id ON item_types (category_id);
    CREATE INDEX IF NOT EXISTS idx_item_types_published ON item_types (published);

    CREATE INDEX IF NOT EXISTS idx_locations_system_id ON locations (system_id);
    CREATE INDEX IF NOT EXISTS idx_locations_region_id ON locations (region_id);

    CREATE INDEX IF NOT EXISTS idx_solar_systems_region_id ON solar_systems (region_id);

    -- Unique constraints
    CREATE UNIQUE INDEX IF NOT EXISTS idx_character_assets_character_item ON character_assets (character_id, item_id);
  `;

  sqlite.exec(createTablesSql);
  console.log('Database tables created successfully');
}

// Export schema for use in other parts of the application
export { schema };

import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

/**
 * Service for reading static EVE data from Fuzzworks database
 */
export class StaticDataService {
  private static instance: StaticDataService;
  private db: Database | null = null;
  private sqlJs: any = null;

  private constructor() {}

  public static getInstance(): StaticDataService {
    if (!StaticDataService.instance) {
      StaticDataService.instance = new StaticDataService();
    }
    return StaticDataService.instance;
  }

  /**
   * Initialize connection to Fuzzworks database
   */
  public async initialize(): Promise<void> {
    if (this.db) {
      return;
    }

    try {
      // Initialize sql.js if not already done
      if (!this.sqlJs) {
        this.sqlJs = await initSqlJs();
      }

      // Path to Fuzzworks database
      const dbPath = path.join(process.cwd(), 'data', 'sqlite-08092025.sqlite');

      if (!fs.existsSync(dbPath)) {
        throw new Error(`Fuzzworks database not found at: ${dbPath}`);
      }

      // Load the database
      const dbData = fs.readFileSync(dbPath);
      this.db = new this.sqlJs.Database(dbData);

    } catch (error) {
      console.error('Failed to initialize Fuzzworks database:', error);
      throw error;
    }
  }



  /**
   * Get item type information by type ID
   */
  public getItemType(typeId: number): {
    typeId: number;
    typeName: string;
    description?: string;
    groupId?: number;
    categoryId?: number;
    mass?: number;
    volume?: number;
    capacity?: number;
    published?: boolean;
  } | null {
    if (!this.db) {
      console.warn('Fuzzworks database not initialized');
      return null;
    }

        try {
      // Use the invTypes table from EVE SDE with correct column name
      const query = `SELECT * FROM invTypes WHERE typeID = ?`;

      try {
        const stmt = this.db.prepare(query);
        const result = stmt.getAsObject([typeId]);
        stmt.free();

        if (result && Object.keys(result).length > 0) {
          return this.normalizeItemType(result);
        }
      } catch (e) {
        console.error(`Error querying invTypes for typeID ${typeId}:`, e);
        return null;
      }

      console.warn(`Item type ${typeId} not found in Fuzzworks database`);
      return null;

    } catch (error) {
      console.error(`Error fetching item type ${typeId}:`, error);
      return null;
    }
  }

  /**
   * Get multiple item types by IDs
   */
  public getItemTypes(typeIds: number[]): Map<number, any> {
    const results = new Map();

    for (const typeId of typeIds) {
      const itemType = this.getItemType(typeId);
      if (itemType) {
        results.set(typeId, itemType);
      }
    }

    return results;
  }

  /**
   * Search for item types by name
   */
  public searchItemTypes(searchTerm: string, limit: number = 50): any[] {
    if (!this.db) {
      console.warn('Fuzzworks database not initialized');
      return [];
    }

        try {
      // Use invTypes table with typeName column
      const stmt = this.db.prepare(`
        SELECT * FROM invTypes
        WHERE typeName LIKE ?
        ORDER BY typeName
        LIMIT ?
      `);

      const results: any[] = [];
      stmt.bind([`%${searchTerm}%`, limit]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(this.normalizeItemType(row));
      }

      stmt.free();
      return results;
    } catch (error) {
      console.error('Error searching item types:', error);
      return [];
    }
  }

  /**
   * Normalize item type data from different possible schemas
   */
  private normalizeItemType(rawData: any): any {
    // Map common field variations to standard names
    const typeId = rawData.typeID || rawData.type_id || rawData.id;
    const typeName = rawData.typeName || rawData.name || rawData.itemName || `Unknown Item ${typeId}`;
    const description = rawData.description || rawData.desc;
    const groupId = rawData.groupID || rawData.group_id;
    const categoryId = rawData.categoryID || rawData.category_id;
    const mass = rawData.mass;
    const volume = rawData.volume;
    const capacity = rawData.capacity;
    const published = rawData.published;

    return {
      typeId,
      typeName,
      description,
      groupId,
      categoryId,
      mass,
      volume,
      capacity,
      published
    };
  }

  /**
   * Get database statistics
   */
  public getStats(): { totalTypes: number; tablesFound: string[] } {
    if (!this.db) {
      return { totalTypes: 0, tablesFound: [] };
    }

    try {
      const tablesResult = this.db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const tablesFound = tablesResult.length > 0 ?
        tablesResult[0].values.map(row => row[0] as string) : [];

            let totalTypes = 0;

      // Count items in invTypes table
      try {
        const countResult = this.db.exec(`SELECT COUNT(*) FROM invTypes`);
        if (countResult.length > 0 && countResult[0].values.length > 0) {
          totalTypes = countResult[0].values[0][0] as number;
        }
      } catch (e) {
        console.error('Error counting invTypes:', e);
      }

      return { totalTypes, tablesFound };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return { totalTypes: 0, tablesFound: [] };
    }
  }

  /**
   * Get station information by station ID
   */
      public getStation(stationId: number): {
    stationId: number;
    stationName: string;
    solarSystemId: number;
    regionId: number;
    constellationId: number;
    stationTypeId?: number;
    corporationId?: number;
  } | null {
    if (!this.db) {
      console.warn('Static database not initialized');
      return null;
    }

    if (!stationId || typeof stationId !== 'number') {
      console.warn('Invalid stationId:', stationId);
      return null;
    }

        try {
      const result = this.db.exec(`
        SELECT
          stationID,
          stationName,
          solarSystemID,
          regionID,
          constellationID,
          stationTypeID,
          corporationID
        FROM staStations
        WHERE stationID = ?
      `, [stationId]);

      if (result.length > 0 && result[0].values && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
          stationId: row[0] as number,
          stationName: row[1] as string,
          solarSystemId: row[2] as number,
          regionId: row[3] as number,
          constellationId: row[4] as number,
          stationTypeId: row[5] as number,
          corporationId: row[6] as number,
        };
      }
    } catch (error) {
      console.error('Error getting station:', error);
    }

    return null;
  }

  /**
   * Get solar system information by system ID
   */
    public getSolarSystem(systemId: number): {
    solarSystemId: number;
    solarSystemName: string;
    regionId: number;
    constellationId: number;
    security: number;
  } | null {
    if (!this.db) {
      console.warn('Database not initialized');
      return null;
    }

    if (!systemId || typeof systemId !== 'number') {
      console.warn('Invalid systemId:', systemId);
      return null;
    }

    try {
      const result = this.db.exec(`
        SELECT
          solarSystemID,
          solarSystemName,
          regionID,
          constellationID,
          security
        FROM mapSolarSystems
        WHERE solarSystemID = ?
      `, [systemId]);

      if (result.length > 0 && result[0].values && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
          solarSystemId: row[0] as number,
          solarSystemName: row[1] as string,
          regionId: row[2] as number,
          constellationId: row[3] as number,
          security: row[4] as number,
        };
      }
    } catch (error) {
      console.error('Error getting solar system:', error);
    }

    return null;
  }

  /**
   * Get region information by region ID
   */
    public getRegion(regionId: number): {
    regionId: number;
    regionName: string;
  } | null {
    if (!this.db) {
      console.warn('Database not initialized');
      return null;
    }

    if (!regionId || typeof regionId !== 'number') {
      console.warn('Invalid regionId:', regionId);
      return null;
    }

    try {
      const result = this.db.exec(`
        SELECT
          regionID,
          regionName
        FROM mapRegions
        WHERE regionID = ?
      `, [regionId]);

      if (result.length > 0 && result[0].values && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
          regionId: row[0] as number,
          regionName: row[1] as string,
        };
      }
    } catch (error) {
      console.error('Error getting region:', error);
    }

    return null;
  }

  /**
   * Close the database connection
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

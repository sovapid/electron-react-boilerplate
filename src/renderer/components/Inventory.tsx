import React, { useState } from 'react';
import './Inventory.css';

interface EVEAsset {
  // Support both snake_case (database) and camelCase (Drizzle ORM output)
  item_id?: number;
  itemId?: number;
  type_id?: number;
  typeId?: number;
  quantity: number;
  location_id?: number;
  locationId?: number;
  location_flag?: string;
  locationFlag?: string;
  location_type?: 'station' | 'solar_system' | 'other';
  locationType?: 'station' | 'solar_system' | 'other';
  is_singleton?: boolean;
  isSingleton?: boolean;
  is_blueprint_copy?: boolean;
  isBlueprintCopy?: boolean;
  resolvedItemType?: any;
  resolvedLocation?: any;
}

interface InventoryProps {
  characterId: number;
  characterName: string;
}

const Inventory: React.FC<InventoryProps> = ({ characterId, characterName }) => {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [staticDataStats, setStaticDataStats] = useState<any>(null);



  const fetchInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the enhanced asset data with item name resolution
      const inventoryData = await window.electron.eveAPI.getCharacterAssets(characterId);
      setAssets(inventoryData);
      setLastUpdated(new Date());

    } catch (err) {
      setError(`Failed to fetch inventory: ${err}`);
      console.error('Inventory fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStaticDataStats = async () => {
    try {
      const stats = await window.electron.eveAPI.getStaticDataStats();
      setStaticDataStats(stats);
      console.log('Static data stats:', stats);
    } catch (err) {
      console.warn('Failed to load static data stats:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      // If search is empty, reload all assets
      await fetchInventory();
      return;
    }

    try {
      setLoading(true);
      const searchResults = await window.electron.eveAPI.searchAssets(characterId, searchTerm);
      setAssets(searchResults);
    } catch (err) {
      setError(`Search failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Load static data stats on component mount
  React.useEffect(() => {
    loadStaticDataStats();
  }, []);

  // Handle search when search term changes (with debouncing)
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm !== '') {
        handleSearch();
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const formatLocationFlag = (flag: string) => {
    // Convert location flags to readable format
    const flagMappings: { [key: string]: string } = {
      'Hangar': 'Station Hangar',
      'ShipHangar': 'Ship Hangar',
      'CargoHold': 'Cargo Hold',
      'DroneBay': 'Drone Bay',
      'FuelBay': 'Fuel Bay',
      'OreHold': 'Ore Hold',
      'GasHold': 'Gas Hold',
      'MineralHold': 'Mineral Hold',
      'SalvageHold': 'Salvage Hold',
      'SpecializedFuelBay': 'Specialized Fuel Bay',
      'SpecializedOreHold': 'Specialized Ore Hold',
      'SpecializedGasHold': 'Specialized Gas Hold',
      'SpecializedMineralHold': 'Specialized Mineral Hold',
      'SpecializedSalvageHold': 'Specialized Salvage Hold',
      'SpecializedShipHold': 'Specialized Ship Hold',
      'SpecializedSmallShipHold': 'Specialized Small Ship Hold',
      'SpecializedMediumShipHold': 'Specialized Medium Ship Hold',
      'SpecializedLargeShipHold': 'Specialized Large Ship Hold',
      'SpecializedIndustrialShipHold': 'Specialized Industrial Ship Hold',
      'SpecializedAmmoHold': 'Specialized Ammo Hold',
      'StructureActive': 'Structure Active',
      'StructureInactive': 'Structure Inactive',
      'StructureFuel': 'Structure Fuel',
      'StructureReactor': 'Structure Reactor',
      'CorpSAG1': 'Corp Hangar 1',
      'CorpSAG2': 'Corp Hangar 2',
      'CorpSAG3': 'Corp Hangar 3',
      'CorpSAG4': 'Corp Hangar 4',
      'CorpSAG5': 'Corp Hangar 5',
      'CorpSAG6': 'Corp Hangar 6',
      'CorpSAG7': 'Corp Hangar 7'
    };

    return flagMappings[flag] || flag;
  };

    const formatLocationInfo = (asset: any) => {
    const resolvedLocation = asset.resolvedLocation;
    if (!resolvedLocation) {
      return { text: `Location ${asset.location_id || 'Unknown'}`, className: 'unknown' };
    }

    const { locationName, locationType, solarSystem, region } = resolvedLocation;

    let securityClass = '';
    if (solarSystem?.security !== undefined) {
      securityClass = solarSystem.security >= 0.5 ? 'high-sec' :
                     solarSystem.security > 0.0 ? 'low-sec' : 'null-sec';
    }

    switch (locationType) {
      case 'station':
        if (solarSystem && region) {
          return {
            text: `${locationName} (${solarSystem.name} ${solarSystem.security.toFixed(1)} - ${region.name})`,
            className: securityClass
          };
        } else {
          return {
            text: locationName,
            className: 'unknown'
          };
        }

      case 'solar_system':
        if (solarSystem && region) {
          return {
            text: `${locationName} System (${solarSystem.security.toFixed(1)} - ${region.name})`,
            className: securityClass
          };
        } else {
          return {
            text: `${locationName} System`,
            className: 'unknown'
          };
        }

      case 'structure':
        return {
          text: `${locationName} (Player Structure)`,
          className: 'structure'
        };

      case 'unknown':
        // For items inside other items (ships, containers), show the container info
        if (asset.location_id && asset.location_id > 2000000000) {
          return {
            text: `Inside Item ${asset.location_id}`,
            className: 'unknown'
          };
        }
        return {
          text: locationName,
          className: 'unknown'
        };

      default:
        return {
          text: `${locationName} (${locationType})`,
          className: 'unknown'
        };
    }
  };

    const groupAssetsByLocation = () => {
    // Build a map of item ID to asset for easy lookup
    const assetMap = new Map<number, EVEAsset>();
    assets.forEach(asset => {
      const itemId = asset.itemId || asset.item_id;
      if (itemId) {
        assetMap.set(itemId, asset);
      }
    });

    const grouped: { [key: string]: EVEAsset[] } = {};
    const processedAssets = new Set<number>();

    // Get unique location IDs for grouping
    const uniqueLocationIds = [...new Set(assets.map(asset => asset.locationId || asset.location_id))];

    assets.forEach(asset => {
      const itemId = asset.itemId || asset.item_id;
      const locationId = asset.locationId || asset.location_id;
      const locationFlag = asset.locationFlag || asset.location_flag;

      // Skip if already processed as a fitted item
      if (processedAssets.has(itemId!)) return;

      // Check if this asset's location_id matches another asset's item_id (fitted to ship/container)
      const parentAsset = assetMap.get(locationId!);

      if (parentAsset && parentAsset !== asset) {
        // This is a fitted item - group it under the parent
        const parentItemId = parentAsset.itemId || parentAsset.item_id;
        const parentLocationId = parentAsset.locationId || parentAsset.location_id;
        const parentLocationFlag = parentAsset.locationFlag || parentAsset.location_flag;

        const parentKey = `${parentLocationId}-${parentLocationFlag}-ship-${parentItemId}`;

        if (!grouped[parentKey]) {
          grouped[parentKey] = [parentAsset]; // Add the ship first
          processedAssets.add(parentItemId!);
        }

        grouped[parentKey].push(asset); // Add the fitted item
        processedAssets.add(itemId!);
      } else {
        // This is a regular asset (not fitted to anything)
        const locationKey = `${locationId}-${locationFlag}`;

        if (!grouped[locationKey]) {
          grouped[locationKey] = [];
        }
        grouped[locationKey].push(asset);
        processedAssets.add(itemId!);
      }
    });

    return grouped;
  };

  const groupedAssets = groupAssetsByLocation();

      return (
    <div className="inventory">
      <div className="inventory-header">
        <h2>Inventory - {characterName}</h2>
        <div className="inventory-controls">
          <button
            onClick={fetchInventory}
            disabled={loading}
            className="fetch-button"
          >
            {loading ? 'Loading...' : 'Fetch Inventory'}
          </button>
          {lastUpdated && (
            <span className="last-updated">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="search-section">
          <input
            type="text"
            placeholder="Search items by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button
            onClick={() => setSearchTerm('')}
            className="clear-search-button"
            disabled={!searchTerm}
          >
            Clear
          </button>
          {staticDataStats && (
            <span className="static-data-info">
              Static data: {staticDataStats.totalTypes.toLocaleString()} items from {staticDataStats.tablesFound.length} tables
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Fetching character inventory from EVE Online...</p>
        </div>
      )}

      {assets.length === 0 && !loading && !error && (
        <div className="no-data">
          <p>No inventory data loaded yet.</p>
          <p>Click "Fetch Inventory" to load your character's assets.</p>
        </div>
      )}

      {assets.length > 0 && (
        <div className="inventory-summary">
          <h3>Inventory Summary</h3>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-label">Total Items:</span>
              <span className="stat-value">{assets.length.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Locations:</span>
              <span className="stat-value">{Object.keys(groupedAssets).length}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Unique Types:</span>
              <span className="stat-value">{new Set(assets.map(a => a.type_id)).size}</span>
            </div>
          </div>
        </div>
      )}

      {Object.keys(groupedAssets).length > 0 && (
        <div className="inventory-content">
          <h3>Items by Location</h3>
          {Object.entries(groupedAssets).map(([locationKey, locationAssets]) => {
            const firstAsset = locationAssets[0];
            const isShipGroup = locationKey.includes('-ship-');

            return (
              <div key={locationKey} className={`location-group ${isShipGroup ? 'ship-group' : ''}`}>
                <div className="location-header">
                  <h4 className={`location-name ${formatLocationInfo(firstAsset).className}`}>
                    {isShipGroup ?
                      `🚀 ${firstAsset.itemName || `Ship Type: ${firstAsset.typeId || firstAsset.type_id}`} - ${formatLocationInfo(firstAsset).text}` :
                      `${formatLocationFlag(firstAsset.locationFlag || firstAsset.location_flag)} - ${formatLocationInfo(firstAsset).text}`
                    }
                  </h4>
                  <span className="item-count">{locationAssets.length} items</span>
                </div>
                <div className="assets-list">
                  {locationAssets.map((asset, index) => {
                    const isShipHull = isShipGroup && index === 0;
                    const isFittedItem = isShipGroup && index > 0;

                    return (
                      <div key={`${asset.itemId || asset.item_id}-${index}`} className={`asset-item ${isShipHull ? 'ship-hull' : ''} ${isFittedItem ? 'fitted-item' : ''}`}>
                        <div className="asset-info">
                          <div className="asset-main">
                            <span className="asset-name">
                              {isFittedItem && <span className="slot-indicator">{formatLocationFlag(asset.locationFlag || asset.location_flag)}: </span>}
                              {asset.itemName || `Type ID: ${asset.typeId || asset.type_id}`}
                              {asset.dataSource === 'static' && <span className="data-source-badge">✓</span>}
                            </span>
                            <span className="asset-quantity">Qty: {asset.quantity.toLocaleString()}</span>
                          </div>
                          <div className="asset-details">
                            <span className="asset-id">Item ID: {asset.itemId || asset.item_id}</span>
                            <span className="asset-type-id">Type: {asset.typeId || asset.type_id}</span>
                            {asset.volume && (
                              <span className="asset-volume">Vol: {(asset.volume * asset.quantity).toFixed(2)} m³</span>
                            )}
                            {asset.mass && (
                              <span className="asset-mass">Mass: {(asset.mass * asset.quantity).toFixed(2)} kg</span>
                            )}
                            {(asset.isSingleton || asset.is_singleton) && (
                              <span className="asset-singleton">Unique Item</span>
                            )}
                            {(asset.isBlueprintCopy || asset.is_blueprint_copy) && (
                              <span className="asset-blueprint">Blueprint Copy</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Inventory;

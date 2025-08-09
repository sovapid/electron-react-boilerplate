// EVE ESI API Configuration

export const ESI_CONFIG = {
  // ESI API Base URLs
  ESI_BASE_URL: 'https://esi.evetech.net/latest',
  ESI_OAUTH_URL: 'https://login.eveonline.com/v2/oauth',

  // OAuth Configuration
  CLIENT_ID: 'b67ea08d406e44759394874a6eeb5267', // Replace with your registered app's client ID
  REDIRECT_URI: 'http://localhost:8080/auth/callback', // This will be dynamically set by CallbackServer

  // Required scopes for inventory management
  REQUIRED_SCOPES: [
    'esi-assets.read_assets.v1',
    'esi-location.read_location.v1',
    'esi-location.read_ship_type.v1',
    'esi-universe.read_structures.v1'
  ],

  // Rate limiting
  RATE_LIMIT: {
    DEFAULT: 150, // requests per second
    BURST: 400   // burst limit
  },

  // Cache TTL (in seconds)
  CACHE_TTL: {
    CHARACTER_INFO: 3600,     // 1 hour
    ASSETS: 300,              // 5 minutes
    TYPE_INFO: 86400,         // 24 hours
    LOCATIONS: 3600           // 1 hour
  }
};

export const ESI_ENDPOINTS = {
  // Authentication
  AUTHORIZE: '/authorize',
  TOKEN: '/token',
  VERIFY: '/verify',

  // Character endpoints
  CHARACTER_INFO: (characterId: number) => `/characters/${characterId}/`,
  CHARACTER_ASSETS: (characterId: number) => `/characters/${characterId}/assets/`,
  CHARACTER_LOCATION: (characterId: number) => `/characters/${characterId}/location/`,
  CHARACTER_SHIP: (characterId: number) => `/characters/${characterId}/ship/`,

  // Universe endpoints
  TYPE_INFO: (typeId: number) => `/universe/types/${typeId}/`,
  STRUCTURE_INFO: (structureId: number) => `/universe/structures/${structureId}/`,
  STATION_INFO: (stationId: number) => `/universe/stations/${stationId}/`,
  SYSTEM_INFO: (systemId: number) => `/universe/systems/${systemId}/`,

  // Status
  SERVER_STATUS: '/status/'
};

// User Agent for API requests
export const USER_AGENT = 'EVE-Inventory-Manager/1.0.0 (https://github.com/your-username/eve-inventory)';

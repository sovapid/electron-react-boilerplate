# EVE Online Inventory Management App - Implementation Plan

## 🎯 Project Overview
Building an Electron app that integrates with EVE Online's ESI (EVE Swagger Interface) API to manage character inventories, with OAuth authentication and SQLite for local data storage.

## 📋 Detailed Implementation Plan

### Phase 1: Research & Setup
**🔍 Research EVE Online ESI API**
- Study EVE ESI documentation (https://esi.evetech.net/ui/)
- Identify required endpoints:
  - `/characters/{character_id}/assets/` - Character assets/inventory
  - `/characters/{character_id}/` - Character info
  - `/universe/types/{type_id}/` - Item type information
  - `/characters/{character_id}/location/` - Current location
- Understand rate limiting and authentication requirements
- Register application with EVE Online developers portal

**🗄️ Database Schema Design**
```sql
-- Characters table
CREATE TABLE characters (
  character_id INTEGER PRIMARY KEY,
  character_name TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires INTEGER,
  last_sync INTEGER
);

-- Items/Types cache
CREATE TABLE item_types (
  type_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  group_id INTEGER,
  category_id INTEGER,
  volume REAL,
  icon_id INTEGER
);

-- Character assets/inventory
CREATE TABLE character_assets (
  item_id INTEGER PRIMARY KEY,
  character_id INTEGER,
  type_id INTEGER,
  quantity INTEGER,
  location_id INTEGER,
  location_flag TEXT,
  is_singleton BOOLEAN,
  FOREIGN KEY (character_id) REFERENCES characters(character_id),
  FOREIGN KEY (type_id) REFERENCES item_types(type_id)
);

-- Locations cache
CREATE TABLE locations (
  location_id INTEGER PRIMARY KEY,
  name TEXT,
  type TEXT -- station, structure, ship, etc.
);
```

### Phase 2: Authentication System
**🔐 EVE Online OAuth2 Implementation**
- Set up OAuth2 flow using EVE's authentication
- Implement secure token storage (encrypted in SQLite)
- Handle token refresh automatically
- Support multiple character authentication
- Store character permissions/scopes

**Required Dependencies:**
```json
{
  "axios": "^1.x.x",
  "sqlite3": "^5.x.x", 
  "electron-store": "^8.x.x",
  "crypto-js": "^4.x.x"
}
```

### Phase 3: Core Architecture
**🏗️ Application Structure**
```
src/
├── main/
│   ├── database/
│   │   ├── db.ts          # SQLite connection & queries
│   │   ├── migrations.ts   # Database migrations
│   │   └── models/        # Data models
│   ├── api/
│   │   ├── esi-client.ts  # EVE ESI API client
│   │   ├── auth.ts        # OAuth2 handling
│   │   └── sync.ts        # Data synchronization
│   └── main.ts
├── renderer/
│   ├── components/
│   │   ├── Auth/          # Login components
│   │   ├── Characters/    # Character selection
│   │   ├── Inventory/     # Inventory display & management
│   │   └── Common/        # Shared components
│   ├── hooks/             # React hooks for API calls
│   ├── store/             # State management (Redux/Zustand)
│   └── App.tsx
```

### Phase 4: UI Development
**🎨 Main Interface Components**
1. **Authentication Screen**
   - EVE Online login button
   - Character selection after auth
   - Token status display

2. **Character Dashboard**
   - Character switcher dropdown
   - Last sync timestamp
   - Sync status indicator

3. **Inventory Interface**
   - Searchable item list with filters
   - Location-based organization (stations, ships, etc.)
   - Item details panel
   - Bulk operations (move, search across characters)

4. **Settings/Configuration**
   - Auto-sync intervals
   - Data export options
   - Character management

### Phase 5: API Integration
**🔌 ESI API Implementation**
- Implement rate-limited API client
- Character data fetching
- Asset/inventory synchronization
- Item type data caching
- Location name resolution
- Error handling and retry logic

### Phase 6: Data Management
**📊 Synchronization Strategy**
- Background sync with configurable intervals
- Delta updates (only fetch changes)
- Conflict resolution for multiple characters
- Data export (CSV, JSON)
- Backup/restore functionality

### Phase 7: Advanced Features
**⚡ Enhanced Inventory Management**
- Cross-character item search
- Location-based filtering
- Item value tracking (market data integration)
- Inventory alerts (low quantities, valuable items)
- Custom item categorization/tagging

### Phase 8: Testing & Deployment
**🧪 Quality Assurance**
- Unit tests for database operations
- Integration tests for API calls
- E2E tests for user workflows
- Error handling validation
- Performance testing with large inventories

**📦 Build & Distribution**
- Electron builder configuration
- Auto-updater setup
- Code signing for security
- Platform-specific packaging (Windows, macOS, Linux)

## 🔧 Technical Considerations

### Security
- Encrypt stored tokens
- Implement secure OAuth2 flow
- Validate all API responses
- Handle token expiration gracefully

### Performance
- Implement lazy loading for large inventories
- Cache frequently accessed item data
- Optimize database queries with indexes
- Background processing for sync operations

### User Experience
- Offline mode with cached data
- Progress indicators for sync operations
- Intuitive search and filtering
- Responsive design for different screen sizes

## 📅 Estimated Timeline
- **Phase 1-2**: 1-2 weeks (Research & Auth)
- **Phase 3-4**: 2-3 weeks (Architecture & UI)
- **Phase 5-6**: 2-3 weeks (API & Data Management)
- **Phase 7-8**: 1-2 weeks (Features & Testing)

**Total: 6-10 weeks** depending on feature scope

## 🎯 Current Status
**🚀 CORE APPLICATION COMPLETED**: Full EVE Online inventory management system implemented and working!

### ✅ Completed Phases:
- **Phase 1-2**: Research & Authentication System ✅
- **Phase 3**: Core Architecture ✅
- **Phase 4**: UI Development ✅
- **Phase 5**: API Integration ✅
- **Phase 6**: Data Management ✅
- **Phase 7**: Advanced Features ✅
- **Phase 8**: Testing & Deployment (Final Polish) 🔄

### ✅ Major Features Completed:

#### 🔐 Authentication System
- **EVE Online OAuth2 Authentication** - PKCE-based secure authentication flow
- **Automatic Callback Handling** - Local HTTP server captures OAuth redirects automatically
- **Character Management** - Add, select, and remove authenticated characters
- **Token Management** - Secure encrypted storage with automatic refresh

#### 🗄️ Database & Data Management
- **SQLite Database** - Local storage with Drizzle ORM integration
- **Character Data Storage** - Persistent character information and auth tokens
- **Asset Caching** - Local inventory storage with sync capabilities
- **Item Type Resolution** - Integration with Fuzzworks static data (50,235+ EVE items)
- **Data Synchronization** - Background sync with ESI API and local caching

#### 🔌 ESI API Integration
- **Character Assets API** - Fetch complete character inventories
- **Universe Data API** - Item type information and metadata
- **Enhanced ESI Client** - Rate-limited client with caching and fallback mechanisms
- **Token Refresh** - Automatic handling of expired access tokens

#### 🎨 User Interface
- **Modern React UI** - Clean interface with character selection and inventory display
- **Location-based Organization** - Items grouped by station/location with hierarchical display
- **Security Status Color Coding** - High-sec (green), low-sec (orange), null-sec (red) visual indicators
- **Ship & Fitting Display** - Ships shown with fitted modules indented underneath
- **Slot Indicators** - HiSlot, MedSlot, LowSlot badges for fitted modules
- **Real-time Search** - Search through cached inventory items
- **Item Details** - Display item names, descriptions, volume, mass, and metadata
- **Data Source Indicators** - Visual badges showing data sources (static vs API)

#### ⚡ Advanced Features
- **Cross-character Management** - Handle multiple authenticated characters
- **Intelligent Caching** - Store and retrieve inventory data locally
- **Search Functionality** - Find items across cached inventories
- **Static Data Integration** - 96 EVE database tables with comprehensive item information
- **Location Resolution** - Station, solar system, and region name resolution with security status
- **Structure API Integration** - Live ESI API calls for player-owned citadels/structures
- **Ship Hierarchy Display** - Fitted modules grouped under their parent ships with slot indicators
- **Asset Statistics** - Track inventory counts and database stats

### 🧪 Fully Tested & Working:
- Character authentication with EVE Online SSO ✅
- Token storage, encryption, and refresh ✅ 
- Character selection and management ✅
- Automatic browser-based auth flow ✅
- Complete inventory fetching and display ✅
- Real item name resolution (50K+ items) ✅
- Location name resolution with security status ✅
- **Player structure name resolution via ESI API** ✅
- Ship hierarchy with fitted module display ✅
- Multi-location inventory organization ✅
- Security-based color coding (high/low/null sec) ✅
- **Complete location hierarchy** (stations, structures, systems, regions) ✅
- Local SQLite database with Drizzle ORM ✅
- Search functionality across cached assets ✅
- Static data integration with Fuzzworks database ✅
- Cross-process communication (Main ↔ Renderer) ✅

### 🎯 Remaining Work:
- **Auto-download Static Database** - Download Fuzzworks SQLite database on first run if missing
- **Package for Distribution** - Build Windows/macOS/Linux executables  
- **Performance Optimization** - Fine-tune for large inventories
- **Additional Testing** - Edge cases and error scenarios

## 📝 Notes
- This plan focuses on core inventory management functionality
- Future phases could include market data integration, trading tools, and fleet management
- Regular backups and data export capabilities are essential for user data safety

### 🔧 Static Database Auto-Download Implementation
**Objective**: Automatically download the Fuzzworks static data export on first run to improve user experience.

**Technical Details:**
- **Check on app startup**: Verify if `data/sqlite-08092025.sqlite` exists
- **Download source**: Fuzzworks static data export (https://www.fuzzwork.co.uk/dump/)
- **Progress indication**: Show download progress in UI during first-time setup
- **Error handling**: Graceful fallback if download fails (manual download instructions)
- **File validation**: Verify database integrity after download (file size, basic queries)
- **Automatic updates**: Optional - check for newer database versions periodically

**Implementation Strategy:**
1. Add database download service in main process
2. Create first-time setup UI component 
3. Integrate with existing database initialization flow
4. Add progress indicators and error handling
5. Test with slow network conditions

**Benefits:**
- **Improved UX**: Users don't need to manually download large database files
- **Easier distribution**: Smaller initial download size for the application
- **Always current**: Can automatically update to latest static data versions

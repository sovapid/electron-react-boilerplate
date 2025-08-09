// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  eveAPI: {
    // Authentication methods
    initiateAuth: () => ipcRenderer.invoke('auth:initiate'),
    handleAuthCallback: (callbackUrl: string) => ipcRenderer.invoke('auth:callback', callbackUrl),
    getCharacters: () => ipcRenderer.invoke('auth:get-characters'),
    removeCharacter: (characterId: number) => ipcRenderer.invoke('auth:remove-character', characterId),
    getSelectedCharacter: () => ipcRenderer.invoke('auth:get-selected-character'),
    setSelectedCharacter: (characterId: number) => ipcRenderer.invoke('auth:set-selected-character', characterId),

    // Character data methods
    getCharacterInfo: (characterId: number) => ipcRenderer.invoke('character:get-info', characterId),
    getCharacterAssets: (characterId: number) => ipcRenderer.invoke('character:get-assets', characterId),
    getCharacterLocation: (characterId: number) => ipcRenderer.invoke('character:get-location', characterId),
    getCharacterShip: (characterId: number) => ipcRenderer.invoke('character:get-ship', characterId),

    // Database methods
    getCachedAssets: (characterId: number) => ipcRenderer.invoke('database:get-cached-assets', characterId),
    refreshAssets: (characterId: number) => ipcRenderer.invoke('database:refresh-assets', characterId),
    searchAssets: (characterId: number, searchTerm: string) => ipcRenderer.invoke('database:search-assets', characterId, searchTerm),
    getAssetStats: (characterId: number) => ipcRenderer.invoke('database:get-asset-stats', characterId),
    getDatabaseStats: () => ipcRenderer.invoke('database:get-stats'),
    cacheMissingTypes: (typeIds: number[]) => ipcRenderer.invoke('database:cache-missing-types', typeIds),
    resetDatabase: () => ipcRenderer.invoke('database:reset'),

    // Static data methods
    searchStaticItems: (searchTerm: string, limit?: number) => ipcRenderer.invoke('static-data:search-items', searchTerm, limit),
    getStaticItem: (typeId: number) => ipcRenderer.invoke('static-data:get-item', typeId),
    getStaticDataStats: () => ipcRenderer.invoke('static-data:get-stats'),

    // Universe data methods
    getTypeInfo: (typeId: number) => ipcRenderer.invoke('universe:get-type-info', typeId),
    getStructureInfo: (characterId: number, structureId: number) => ipcRenderer.invoke('universe:get-structure-info', characterId, structureId),
    getStationInfo: (stationId: number) => ipcRenderer.invoke('universe:get-station-info', stationId),
    getSystemInfo: (systemId: number) => ipcRenderer.invoke('universe:get-system-info', systemId),
    getServerStatus: () => ipcRenderer.invoke('universe:get-server-status'),
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;

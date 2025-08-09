import Store from 'electron-store';
import CryptoJS from 'crypto-js';
import { StoredCharacterAuth } from '../api/types';

// Schema for the auth store
interface AuthStoreSchema {
  characters: Record<number, StoredCharacterAuth>;
  encryption_key?: string;
  last_selected_character?: number;
}

export class AuthStore {
  private store: Store<AuthStoreSchema>;
  private encryptionKey: string;

  constructor() {
    // Initialize store without encryption first
    this.store = new Store<AuthStoreSchema>({
      name: 'eve-auth',
      defaults: {
        characters: {},
        last_selected_character: undefined
      }
    });

    // Now we can safely get/create the encryption key
    this.encryptionKey = this.getOrCreateEncryptionKey();
  }

  /**
   * Get or create an encryption key for storing sensitive data
   */
  private getOrCreateEncryptionKey(): string {
    let key = this.store.get('encryption_key');
    if (!key) {
      key = CryptoJS.lib.WordArray.random(256/8).toString();
      this.store.set('encryption_key', key);
    }
    return key;
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(data: string): string {
    return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Store character authentication data
   */
  public storeCharacterAuth(auth: StoredCharacterAuth): void {
    const characters = this.store.get('characters');

    // Encrypt sensitive tokens
    const encryptedAuth: StoredCharacterAuth = {
      ...auth,
      access_token: this.encrypt(auth.access_token),
      refresh_token: this.encrypt(auth.refresh_token)
    };

    characters[auth.character_id] = encryptedAuth;
    this.store.set('characters', characters);

    // Set as last selected character if it's the first one
    if (!this.store.get('last_selected_character')) {
      this.store.set('last_selected_character', auth.character_id);
    }
  }

  /**
   * Get character authentication data
   */
  public getCharacterAuth(characterId: number): StoredCharacterAuth | null {
    const characters = this.store.get('characters');
    const encryptedAuth = characters[characterId];

    if (!encryptedAuth) {
      return null;
    }

    // Decrypt sensitive tokens
    try {
      return {
        ...encryptedAuth,
        access_token: this.decrypt(encryptedAuth.access_token),
        refresh_token: this.decrypt(encryptedAuth.refresh_token)
      };
    } catch (error) {
      console.error('Failed to decrypt character auth data:', error);
      return null;
    }
  }

  /**
   * Get all stored characters (without decrypting tokens)
   */
  public getAllCharacters(): Array<Pick<StoredCharacterAuth, 'character_id' | 'character_name' | 'token_expires' | 'scopes' | 'last_updated'>> {
    const characters = this.store.get('characters');

    return Object.values(characters).map(auth => ({
      character_id: auth.character_id,
      character_name: auth.character_name,
      token_expires: auth.token_expires,
      scopes: auth.scopes,
      last_updated: auth.last_updated
    }));
  }

  /**
   * Update character authentication data
   */
  public updateCharacterAuth(characterId: number, updates: Partial<StoredCharacterAuth>): void {
    const characters = this.store.get('characters');
    const existingAuth = characters[characterId];

    if (!existingAuth) {
      throw new Error(`Character ${characterId} not found in store`);
    }

    // Encrypt tokens if they're being updated
    const encryptedUpdates = { ...updates };
    if (updates.access_token) {
      encryptedUpdates.access_token = this.encrypt(updates.access_token);
    }
    if (updates.refresh_token) {
      encryptedUpdates.refresh_token = this.encrypt(updates.refresh_token);
    }

    characters[characterId] = { ...existingAuth, ...encryptedUpdates };
    this.store.set('characters', characters);
  }

  /**
   * Remove character authentication data
   */
  public removeCharacterAuth(characterId: number): void {
    const characters = this.store.get('characters');
    delete characters[characterId];
    this.store.set('characters', characters);

    // Clear last selected if it was this character
    if (this.store.get('last_selected_character') === characterId) {
      const remainingCharacters = Object.keys(characters);
      if (remainingCharacters.length > 0) {
        this.store.set('last_selected_character', parseInt(remainingCharacters[0], 10));
      } else {
        this.store.delete('last_selected_character');
      }
    }
  }

  /**
   * Check if a character's token is expired
   */
  public isTokenExpired(characterId: number): boolean {
    const auth = this.getCharacterAuth(characterId);
    if (!auth) {
      return true;
    }

    // Consider token expired if it expires within the next 5 minutes
    return auth.token_expires < (Date.now() + 300000);
  }

  /**
   * Get/Set the last selected character
   */
  public getLastSelectedCharacter(): number | undefined {
    return this.store.get('last_selected_character');
  }

  public setLastSelectedCharacter(characterId: number): void {
    this.store.set('last_selected_character', characterId);
  }

  /**
   * Clear all stored authentication data
   */
  public clearAllAuth(): void {
    this.store.set('characters', {});
    this.store.delete('last_selected_character');
  }

  /**
   * Check if any characters are stored
   */
  public hasStoredCharacters(): boolean {
    const characters = this.store.get('characters');
    return Object.keys(characters).length > 0;
  }

  /**
   * Get store file path for debugging
   */
  public getStorePath(): string {
    return this.store.path;
  }
}

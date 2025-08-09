import { eq, and } from 'drizzle-orm';
import { getDatabase, schema } from '../db';
import { Character, NewCharacter, CharacterAsset, NewCharacterAsset } from '../schema';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'eve-inventory-encryption-key-2024'; // In production, this should be securely generated

export class CharacterService {
  private getDb() {
    return getDatabase();
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(data: string): Buffer {
    const encrypted = CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
    return Buffer.from(encrypted, 'utf8');
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedData: Buffer): string {
    const encryptedString = encryptedData.toString('utf8');
    const bytes = CryptoJS.AES.decrypt(encryptedString, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Store or update a character's information
   */
  async upsertCharacter(characterData: {
    characterId: number;
    characterName: string;
    corporationId?: number;
    allianceId?: number;
    securityStatus?: number;
    birthday?: string;
    raceId?: number;
    bloodlineId?: number;
    ancestryId?: number;
    gender?: 'male' | 'female';
    accessToken: string;
    refreshToken: string;
    tokenExpires: number;
    scopes: string[];
  }): Promise<Character> {
    const now = Math.floor(Date.now() / 1000);

    const characterRecord: NewCharacter = {
      characterId: characterData.characterId,
      characterName: characterData.characterName,
      corporationId: characterData.corporationId,
      allianceId: characterData.allianceId,
      securityStatus: characterData.securityStatus,
      birthday: characterData.birthday,
      raceId: characterData.raceId,
      bloodlineId: characterData.bloodlineId,
      ancestryId: characterData.ancestryId,
      gender: characterData.gender,
      accessToken: this.encrypt(characterData.accessToken),
      refreshToken: this.encrypt(characterData.refreshToken),
      tokenExpires: characterData.tokenExpires,
      scopes: JSON.stringify(characterData.scopes),
      updatedAt: now,
    };

    // Use INSERT OR REPLACE for upsert functionality
    await this.getDb()
      .insert(schema.characters)
      .values(characterRecord)
      .onConflictDoUpdate({
        target: schema.characters.characterId,
        set: {
          characterName: characterRecord.characterName,
          corporationId: characterRecord.corporationId,
          allianceId: characterRecord.allianceId,
          securityStatus: characterRecord.securityStatus,
          birthday: characterRecord.birthday,
          raceId: characterRecord.raceId,
          bloodlineId: characterRecord.bloodlineId,
          ancestryId: characterRecord.ancestryId,
          gender: characterRecord.gender,
          accessToken: characterRecord.accessToken,
          refreshToken: characterRecord.refreshToken,
          tokenExpires: characterRecord.tokenExpires,
          scopes: characterRecord.scopes,
          updatedAt: characterRecord.updatedAt,
        },
      });

    // Return the stored character (without decrypted tokens)
    const stored = await this.getCharacter(characterData.characterId);
    if (!stored) {
      throw new Error('Failed to store character data');
    }
    return stored;
  }

  /**
   * Get a character by ID
   */
  async getCharacter(characterId: number): Promise<Character | null> {
    const result = await this.getDb()
      .select()
      .from(schema.characters)
      .where(eq(schema.characters.characterId, characterId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get all stored characters
   */
  async getAllCharacters(): Promise<Character[]> {
    return await this.getDb().select().from(schema.characters);
  }

  /**
   * Get decrypted authentication tokens for a character
   */
  async getCharacterTokens(characterId: number): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenExpires: number;
    scopes: string[];
  } | null> {
    const character = await this.getCharacter(characterId);
    if (!character || !character.accessToken || !character.refreshToken) {
      return null;
    }

    try {
      return {
        accessToken: this.decrypt(character.accessToken),
        refreshToken: this.decrypt(character.refreshToken),
        tokenExpires: character.tokenExpires,
        scopes: JSON.parse(character.scopes),
      };
    } catch (error) {
      console.error('Failed to decrypt character tokens:', error);
      return null;
    }
  }

  /**
   * Update character's authentication tokens
   */
  async updateCharacterTokens(
    characterId: number,
    accessToken: string,
    refreshToken: string,
    tokenExpires: number,
    scopes?: string[]
  ): Promise<void> {
    const updateData: any = {
      accessToken: this.encrypt(accessToken),
      refreshToken: this.encrypt(refreshToken),
      tokenExpires,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    if (scopes) {
      updateData.scopes = JSON.stringify(scopes);
    }

    await this.getDb()
      .update(schema.characters)
      .set(updateData)
      .where(eq(schema.characters.characterId, characterId));
  }

  /**
   * Delete a character and all associated data
   */
  async deleteCharacter(characterId: number): Promise<void> {
    // Delete character assets first (due to foreign key constraint)
    await this.getDb()
      .delete(schema.characterAssets)
      .where(eq(schema.characterAssets.characterId, characterId));

    // Delete the character
    await this.getDb()
      .delete(schema.characters)
      .where(eq(schema.characters.characterId, characterId));
  }

  /**
   * Update the last sync timestamp for a character
   */
  async updateLastSync(characterId: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await this.getDb()
      .update(schema.characters)
      .set({
        lastSync: now,
        updatedAt: now
      })
      .where(eq(schema.characters.characterId, characterId));
  }

  /**
   * Check if a character's token is expired
   */
  async isTokenExpired(characterId: number): Promise<boolean> {
    const character = await this.getCharacter(characterId);
    if (!character) {
      return true;
    }

    // Consider token expired if it expires within the next 5 minutes
    return character.tokenExpires < (Math.floor(Date.now() / 1000) + 300);
  }
}

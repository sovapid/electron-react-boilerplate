// EVE ESI API Types and Interfaces

export interface EVECharacter {
  character_id: number;
  character_name: string;
  corporation_id: number;
  alliance_id?: number;
  birthday: string;
  race_id: number;
  bloodline_id: number;
  ancestry_id: number;
  security_status: number;
  gender: 'male' | 'female';
}

export interface EVEAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface EVEAuthConfig {
  client_id: string;
  client_secret?: string; // Optional for PKCE flow
  redirect_uri: string;
  scope: string[];
  state?: string;
  code_challenge?: string;
  code_challenge_method?: 'S256';
}

export interface StoredCharacterAuth {
  character_id: number;
  character_name: string;
  access_token: string;
  refresh_token: string;
  token_expires: number;
  scopes: string[];
  last_updated: number;
}

export interface EVEError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

// ESI API Response types
export interface ESIResponse<T> {
  data: T;
  expires?: string;
  etag?: string;
  last_modified?: string;
  pages?: number;
}

export interface EVEAsset {
  item_id: number;
  type_id: number;
  quantity: number;
  location_id: number;
  location_flag: string;
  location_type: 'station' | 'solar_system' | 'other';
  is_singleton: boolean;
  is_blueprint_copy?: boolean;
}

export interface EVEType {
  type_id: number;
  name: string;
  description: string;
  published: boolean;
  group_id: number;
  market_group_id?: number;
  mass?: number;
  volume?: number;
  capacity?: number;
  portion_size?: number;
  radius?: number;
  icon_id?: number;
}

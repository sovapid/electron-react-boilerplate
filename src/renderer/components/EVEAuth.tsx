import React, { useState, useEffect } from 'react';
import './EVEAuth.css';
import Inventory from './Inventory';

interface Character {
  character_id: number;
  character_name: string;
  token_expires: number;
  scopes: string[];
  last_updated: number;
}

const EVEAuth: React.FC = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<number | undefined>();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      setLoading(true);
      const chars = await window.electron.eveAPI.getCharacters();
      setCharacters(chars);

      const selected = await window.electron.eveAPI.getSelectedCharacter();
      setSelectedCharacter(selected);
    } catch (err) {
      setError(`Failed to load characters: ${err}`);
    } finally {
      setLoading(false);
    }
  };

      const handleAuthenticate = async () => {
    try {
      setIsAuthenticating(true);
      setError(null);

      // Show loading message
      setError('Opening EVE Online authentication in your browser...');

      // Initiate auth - this will now handle everything automatically
      const authData = await window.electron.eveAPI.initiateAuth();
      console.log('Authentication successful:', authData);

      // Reload characters to show the new one
      await loadCharacters();
      setIsAuthenticating(false);
      setError(null);

    } catch (err) {
      setError(`Authentication failed: ${err}`);
      setIsAuthenticating(false);
    }
  };



  const handleSelectCharacter = async (characterId: number) => {
    try {
      await window.electron.eveAPI.setSelectedCharacter(characterId);
      setSelectedCharacter(characterId);
    } catch (err) {
      setError(`Failed to select character: ${err}`);
    }
  };

  const handleRemoveCharacter = async (characterId: number) => {
    try {
      await window.electron.eveAPI.removeCharacter(characterId);
      await loadCharacters();
    } catch (err) {
      setError(`Failed to remove character: ${err}`);
    }
  };

  const handleRefreshToken = async (characterId: number) => {
    try {
      setError('Refreshing token...');
      // The system should automatically refresh tokens when making API calls
      // Let's trigger a character info fetch to force a token refresh
      await window.electron.eveAPI.getCharacterInfo(characterId);
      await loadCharacters();
      setError(null);
    } catch (err) {
      setError(`Failed to refresh token: ${err}`);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const isTokenExpired = (tokenExpires: number) => {
    return tokenExpires < Date.now();
  };

  if (loading) {
    return (
      <div className="eve-auth">
        <div className="loading">Loading characters...</div>
      </div>
    );
  }

  return (
    <div className="eve-auth">
            <div className="auth-header">
        <h2>EVE Online Characters</h2>
                <button
          onClick={handleAuthenticate}
          disabled={isAuthenticating}
          className="auth-button"
        >
          {isAuthenticating ? 'Authenticating...' : 'Add New Character'}
        </button>
                <button
          onClick={async () => {
            try {
              console.log('Resetting database...');
              await window.electron.eveAPI.resetDatabase();
              console.log('Database reset successfully');
              alert('Database reset successfully! You may need to re-authenticate.');
              // Refresh the character list
              await loadCharacters();
            } catch (error) {
              console.error('Failed to reset database:', error);
              alert('Failed to reset database');
            }
          }}
          className="auth-button"
          style={{ backgroundColor: '#d32f2f', marginLeft: '10px' }}
        >
          Reset Database
        </button>
        <button
          onClick={async () => {
            try {
              console.log('Testing static data...');
              const stats = await window.electron.eveAPI.getStaticDataStats();
              console.log('Static data stats:', stats);
              alert(`Static data: ${stats.totalTypes} items from ${stats.tablesFound.length} tables: ${stats.tablesFound.join(', ')}`);
            } catch (error) {
              console.error('Failed to get static data stats:', error);
              alert(`Static data error: ${error}`);
            }
          }}
          className="auth-button"
          style={{ backgroundColor: '#17a2b8', marginLeft: '10px' }}
        >
          Test Static Data
        </button>
      </div>



      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {characters.length === 0 ? (
        <div className="no-characters">
          <p>No characters authenticated yet.</p>
          <p>Click "Add New Character" to authenticate with EVE Online.</p>
        </div>
      ) : (
        <div className="characters-list">
          {characters.map((character) => (
            <div
              key={character.character_id}
              className={`character-card ${selectedCharacter === character.character_id ? 'selected' : ''}`}
            >
              <div className="character-info">
                <h3>{character.character_name}</h3>
                <p>ID: {character.character_id}</p>
                <p>
                  Token Status:
                  <span className={isTokenExpired(character.token_expires) ? 'expired' : 'valid'}>
                    {isTokenExpired(character.token_expires) ? ' Expired' : ' Valid'}
                  </span>
                </p>
                <p>Expires: {formatDate(character.token_expires)}</p>
                <p>Last Updated: {formatDate(character.last_updated)}</p>
                <p>Scopes: {character.scopes.join(', ')}</p>
              </div>

                            <div className="character-actions">
                {selectedCharacter !== character.character_id && (
                  <button
                    onClick={() => handleSelectCharacter(character.character_id)}
                    className="select-button"
                  >
                    Select
                  </button>
                )}
                {selectedCharacter === character.character_id && (
                  <span className="selected-indicator">✓ Selected</span>
                )}
                {isTokenExpired(character.token_expires) && (
                  <button
                    onClick={() => handleRefreshToken(character.character_id)}
                    className="refresh-button"
                  >
                    Refresh Token
                  </button>
                )}
                <button
                  onClick={() => handleRemoveCharacter(character.character_id)}
                  className="remove-button"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCharacter && (
        <div className="selected-character-info">
          <h3>Selected Character: {characters.find(c => c.character_id === selectedCharacter)?.character_name}</h3>
          <p>Ready for inventory operations!</p>
        </div>
      )}

                  {selectedCharacter && (
        <Inventory
          characterId={selectedCharacter}
          characterName={characters.find(c => c.character_id === selectedCharacter)?.character_name || 'Unknown'}
        />
      )}
    </div>
  );
};

export default EVEAuth;

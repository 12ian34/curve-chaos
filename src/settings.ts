import { getPlayerControls } from './player';

// Define the controls interface here as it's not exported from player.ts
interface PlayerControls {
    left: string;
    right: string;
}

export interface GameSettings {
    playerCount: number;
    // Use the locally defined PlayerControls interface
    controls: PlayerControls[];
}

const SETTINGS_KEY = 'curveChaosSettings';
const DEFAULT_PLAYER_COUNT = 2;

/**
 * Loads game settings from localStorage.
 * Returns default settings if none are found or if loading fails.
 */
export function loadSettings(): GameSettings {
    // Get the current default controls configuration from player.ts
    const defaultControlMap = getPlayerControls();
    const defaultControlsArray: PlayerControls[] = [];
    // Convert map to array, assuming keys 1, 2, 3, 4 exist
    for (let i = 1; i <= 4; i++) {
        const control = defaultControlMap[i]; // Assign to variable first
        if (control) { // Check if it exists
            defaultControlsArray.push(control); // Push the non-undefined variable
        } else {
            // Fallback in case getPlayerControls doesn't return expected keys
            console.warn(`Default controls for player ${i} not found, using fallback.`);
            defaultControlsArray.push({ left: `Key${i * 2 - 1}`, right: `Key${i * 2}` }); 
        }
    }

    try {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings) as GameSettings;
            // Basic validation to ensure structure matches
            if (
                parsedSettings.playerCount && 
                parsedSettings.controls && 
                Array.isArray(parsedSettings.controls) &&
                parsedSettings.playerCount >= 1 && parsedSettings.playerCount <= 4 // Validate player count range
            ) {
                // Ensure controls array has entries for the saved player count
                // Use the fetched defaults if the saved array is too short
                while (parsedSettings.controls.length < parsedSettings.playerCount) {
                    const defaultControl = defaultControlsArray[parsedSettings.controls.length];
                    if (defaultControl) {
                        parsedSettings.controls.push(defaultControl);
                    } else {
                        // Fallback if somehow defaultControlsArray is shorter than expected
                        console.warn(`Missing default control for player ${parsedSettings.controls.length + 1}, using fallback.`);
                        parsedSettings.controls.push({ left: `KeyFallback${parsedSettings.controls.length * 2 + 1}`, right: `KeyFallback${parsedSettings.controls.length * 2 + 2}` });
                    }
                }
                 // Trim excess controls if saved array is longer than player count (e.g., player count was reduced)
                if (parsedSettings.controls.length > parsedSettings.playerCount) {
                    parsedSettings.controls = parsedSettings.controls.slice(0, parsedSettings.playerCount);
                }
                return parsedSettings;
            }
        }
    } catch (error) {
        console.error("Failed to load settings from localStorage:", error);
    }

    // Return default settings if nothing loaded, parsing failed, or validation failed
    return {
        playerCount: DEFAULT_PLAYER_COUNT,
        // Return controls slice based on DEFAULT_PLAYER_COUNT
        controls: defaultControlsArray.slice(0, DEFAULT_PLAYER_COUNT), 
    };
}

/**
 * Saves game settings to localStorage.
 */
export function saveSettings(settings: GameSettings): void {
    try {
        // Ensure we only save controls up to the specified player count
        const settingsToSave: GameSettings = {
            ...settings,
            controls: settings.controls.slice(0, settings.playerCount)
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
    } catch (error) {
        console.error("Failed to save settings to localStorage:", error);
    }
} 
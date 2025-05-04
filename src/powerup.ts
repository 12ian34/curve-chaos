import { Player } from './player';

// Define the types of powerups available
export type PowerupType =
    | 'SPEED_BOOST'       // Increase own speed
    | 'SLOW_OTHERS'       // Decrease speed of opponents
    | 'THIN_TRAIL'        // Make own trail temporarily thinner
    | 'INVINCIBLE'        // Pass through walls and trails temporarily (similar to hole invincibility)
    | 'REVERSE_CONTROLS' // Reverse own controls temporarily (Changed from opponents to self)
    // --- New Powerups ---
    | 'GHOST_MODE'        // Pass through walls & other trails (timed)
    | 'THICK_TRAIL'       // Increase own trail width (timed)
    | 'CLEAR_OWN_TRAIL'   // Instantly remove own trail (instantaneous)
    | 'RANDOM_TELEPORT';  // Instantly move to random safe spot (instantaneous)

// --- Powerup Constants ---
export const POWERUP_CONSTANTS = {
    SPEED_BOOST: {
        DURATION_MS: 5000, // 5 seconds
        SPEED_MULTIPLIER: 1.5, // 50% faster
        COLOR: '#FFD700', // Gold
        SYMBOL: '⚡',
    },
    SLOW_OTHERS: {
        DURATION_MS: 5000, // 5 seconds
        SPEED_MULTIPLIER: 0.7, // 30% slower
        COLOR: '#00FFFF', // Cyan
        SYMBOL: '🐌',
    },
    THIN_TRAIL: {
        DURATION_MS: 10000, // 10 seconds
        TRAIL_RADIUS_MULTIPLIER: 0.2, // Make trail 20% of original width
        COLOR: '#90EE90', // LightGreen
        SYMBOL: '-',
    },
    INVINCIBLE: {
        DURATION_MS: 3000, // 3 seconds
        COLOR: '#FF00FF', // Magenta
        SYMBOL: '🛡️', // Shield emoji
    },
    REVERSE_CONTROLS: {
        DURATION_MS: 5000, // 5 seconds
        COLOR: '#800080', // Purple
        SYMBOL: '↔️', // Left-right arrow
    },
    // --- New Powerup Constants ---
    GHOST_MODE: {
        DURATION_MS: 4000, // 4 seconds
        COLOR: '#E6E6FA', // Lavender (ghostly color)
        SYMBOL: '👻', // Ghost emoji
    },
    THICK_TRAIL: {
        DURATION_MS: 8000, // 8 seconds
        TRAIL_RADIUS_MULTIPLIER: 2.5, // Make trail 2.5x original width
        COLOR: '#FFA500', // Orange
        SYMBOL: '+',
    },
    CLEAR_OWN_TRAIL: {
        // No duration - instantaneous
        COLOR: '#FFFFFF', // White
        SYMBOL: '🧹', // Broom emoji
    },
    RANDOM_TELEPORT: {
        // No duration - instantaneous
        COLOR: '#ADD8E6', // LightBlue
        SYMBOL: '🌀', // Cyclone emoji
    },
    // --- General Constants ---
    DEFAULT_RADIUS: 10, // Visual radius on canvas
    DEFAULT_LIFETIME_MS: 10000, // How long powerups stay before despawning
};

// Define the structure for a powerup object
export interface Powerup {
    id: number;
    type: PowerupType;
    x: number;
    y: number;
    radius: number;
    createdAt: number; // Timestamp (ms) when created, for spawning animations or lifetime
    // duration is now defined in POWERUP_CONSTANTS
    // duration?: number; 
}

// --- Drawing --- 
// Basic function to draw a powerup (can be customized later)
export function drawPowerup(ctx: CanvasRenderingContext2D, powerup: Powerup): void {
    const constants = POWERUP_CONSTANTS[powerup.type];
    if (!constants) return; // Should not happen

    ctx.beginPath();
    ctx.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI * 2);
    
    ctx.fillStyle = constants.COLOR || '#808080'; // Use defined color or fallback grey
    ctx.fill();

    // Draw a white border 
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.closePath();

    // Draw Symbol in the center
    const symbol = constants.SYMBOL;
    if (symbol) {
        ctx.fillStyle = 'black'; // Symbol color
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${powerup.radius * 1.2}px 'Poppins', sans-serif`; // Adjust font size based on radius
        ctx.fillText(symbol, powerup.x, powerup.y);
    }
}

// --- Effect Application (Placeholders - requires modifications to Player and Game State) ---

// This structure needs significant expansion. We need to track active effects on players.
// Maybe add an `activeEffects` array to the Player interface?

// export function applyPowerupEffect(player: Player, powerup: Powerup, allPlayers: Player[]): void {
//     console.log(`Player ${player.id} collected powerup: ${powerup.type}`);
//     switch (powerup.type) {
//         case 'SPEED_BOOST':
//             // Modify player.speed, add timer to revert
//             break;
//         case 'SLOW_OTHERS':
//             // Modify speed of other players, add timer
//             break;
//         // ... and so on
//     }
// }

// export function revertPowerupEffect(player: Player, effectType: PowerupType): void {
//     // Logic to revert specific effects (e.g., restore speed)
// } 
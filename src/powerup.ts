import { Player } from './player';

// Define the types of powerups available
export type PowerupType =
    | 'SPEED_BOOST'       // Increase own speed
    | 'SLOW_OTHERS'       // Decrease speed of opponents
    | 'THIN_TRAIL'        // Make own trail temporarily thinner
    | 'INVINCIBLE'        // Pass through walls and trails temporarily (similar to hole invincibility)
    // | 'CLEAR_SCREEN'      // Instantly clear all trails (Removed for now)
    | 'REVERSE_CONTROLS'; // Reverse own controls temporarily (Changed from opponents to self)

// --- Powerup Constants ---
export const POWERUP_CONSTANTS = {
    SPEED_BOOST: {
        DURATION_MS: 5000, // 5 seconds
        SPEED_MULTIPLIER: 1.5, // 50% faster
    },
    SLOW_OTHERS: {
        DURATION_MS: 5000, // 5 seconds
        SPEED_MULTIPLIER: 0.7, // 30% slower
    },
    THIN_TRAIL: {
        DURATION_MS: 10000, // 10 seconds
        TRAIL_RADIUS_MULTIPLIER: 0.2, // Make trail 20% of original width
    },
    INVINCIBLE: {
        DURATION_MS: 3000, // 3 seconds
    },
    REVERSE_CONTROLS: {
        DURATION_MS: 5000, // 5 seconds
    },
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
    // Optional: duration in milliseconds for timed effects
    duration?: number; 
}

// --- Drawing --- 
// Basic function to draw a powerup (can be customized later)
export function drawPowerup(ctx: CanvasRenderingContext2D, powerup: Powerup): void {
    ctx.beginPath();
    ctx.arc(powerup.x, powerup.y, powerup.radius, 0, Math.PI * 2);
    
    // Basic visual differentiation (can be improved with icons/colors)
    switch (powerup.type) {
        case 'SPEED_BOOST': ctx.fillStyle = 'yellow'; break;
        case 'SLOW_OTHERS': ctx.fillStyle = 'cyan'; break;
        case 'THIN_TRAIL': ctx.fillStyle = 'lightgreen'; break;
        case 'INVINCIBLE': ctx.fillStyle = 'magenta'; break;
        // case 'CLEAR_SCREEN': ctx.fillStyle = 'orange'; break; // Removed
        case 'REVERSE_CONTROLS': ctx.fillStyle = 'purple'; break;
        default: ctx.fillStyle = 'grey';
    }
    
    ctx.fill();
    // Maybe draw a white border or an initial?
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.closePath();
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
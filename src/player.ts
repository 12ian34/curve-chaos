import { PowerupType, POWERUP_CONSTANTS } from './powerup'; // Import PowerupType and CONSTANTS

// --- Constants for Names ---
const ENGLISH_NAMES = ['Ace', 'Bolt', 'Comet', 'Duke', 'Echo', 'Flash', 'Ghost', 'Hawk', 'Jett', 'King'];
const NORWEGIAN_NAMES = ['Bjorn', 'Fjord', 'Frost', 'Harald', 'Leif', 'Odin', 'Rune', 'Sigurd', 'Thor', 'Ulf'];
const SWEDISH_NAMES = ['Axel', 'Birger', 'Erik', 'Gustav', 'Ingvar', 'Lars', 'Magnus', 'Oskar', 'Ragnar', 'Sven'];
const GERMAN_NAMES = ['Adler', 'Blitz', 'Claus', 'Dieter', 'Emil', 'Fritz', 'Gunther', 'Hans', 'Jurgen', 'Kaiser'];

export const NAME_LISTS = {
    English: ENGLISH_NAMES,
    Norwegian: NORWEGIAN_NAMES,
    Swedish: SWEDISH_NAMES,
    German: GERMAN_NAMES,
};

export interface Player {
    id: number;
    name: string; // Added player name
    x: number; // Current x position
    y: number; // Current y position
    angle: number; // Current direction angle in radians
    speed: number; // Pixels per frame
    color: string; // Player's color
    isTurningLeft: boolean;
    isTurningRight: boolean;
    turnSpeed: number; // Radians per frame
    radius: number; // Size of the player's head
    path: ({ x: number; y: number } | null)[]; // Array of points (or null for gaps) representing the trail
    isAlive: boolean; // Is the player currently alive?
    score: number; // Player's score for the session
    // --- Trail Hole Mechanic State ---
    isMakingHole: boolean;
    holeTimer: number; // Remaining duration of the current hole (in frames/updates)
    // --- Active Powerup Effects State ---
    // Stores the expiry timestamp (performance.now()) for each active effect
    activeEffects: { [key in PowerupType]?: number }; 
}

// Define control keys for each player
interface PlayerControls {
    left: string;
    right: string;
}

// Make this mutable and accessible via functions
let playerControls: { [id: number]: PlayerControls } = {
    1: { left: 'arrowleft', right: 'arrowright' }, // Player 1 uses arrow keys
    2: { left: 'a', right: 'd' }, // Player 2 uses A/D keys
    3: { left: 'j', right: 'l' }, // Player 3 uses J/L keys
    4: { left: 'numpad4', right: 'numpad6' }, // Player 4 uses Numpad 4/6
    // Add more controls for more players here
};

// Function to get a copy of the current controls
export function getPlayerControls(): { [id: number]: PlayerControls } {
    // Return a deep copy to prevent external modification
    return JSON.parse(JSON.stringify(playerControls));
}

// Function to set a specific control key
export function setPlayerControl(playerId: number, direction: 'left' | 'right', key: string): void {
    const normalizedKey = key.toLowerCase(); // Normalize key
    if (playerControls[playerId]) {
        playerControls[playerId][direction] = normalizedKey;
        console.log(`Set Player ${playerId} ${direction} control to: ${normalizedKey}`);
    } else {
        console.warn(`Attempted to set control for non-existent player ID: ${playerId}`);
    }
}

// Function to set all controls at once (e.g., from loaded settings)
// Expects an array where index 0 is for player 1, index 1 for player 2, etc.
export function setAllPlayerControls(controlsArray: PlayerControls[]): void {
    // Define default controls here for easy reference
    const defaultControls: { [id: number]: PlayerControls } = {
        1: { left: 'arrowleft', right: 'arrowright' },
        2: { left: 'a', right: 'd' },
        3: { left: 'j', right: 'l' },
        4: { left: 'numpad4', right: 'numpad6' },
    };
    const MAX_PLAYERS = 4; // Define the maximum supported players
    const newControls: { [id: number]: PlayerControls } = {};

    // Load from the array first
    for (let i = 0; i < controlsArray.length; i++) {
        const playerId = i + 1;
        if (playerId > MAX_PLAYERS) continue; // Ignore extra saved controls if any
        const control = controlsArray[i];
        if (control && typeof control.left === 'string' && typeof control.right === 'string') {
             newControls[playerId] = {
                left: control.left.toLowerCase(),
                right: control.right.toLowerCase()
            };
        } else {
             console.warn(`Invalid control data provided for index ${i} (Player ${playerId}), using defaults.`);
             // Use default if loaded data is invalid
             newControls[playerId] = defaultControls[playerId] || { left: 'error', right: 'error' };
        }
    }

    // Ensure defaults exist for any missing players up to MAX_PLAYERS
    for (let playerId = 1; playerId <= MAX_PLAYERS; playerId++) {
        if (!newControls[playerId]) {
            console.log(`No saved controls for Player ${playerId}, applying defaults.`);
            newControls[playerId] = defaultControls[playerId] || { left: 'error', right: 'error' };
        }
    }

    playerControls = newControls; // Replace the entire map
    console.log('Set all player controls:', playerControls);
}

export function createPlayer(id: number, name: string, x: number, y: number, angle: number, color: string, initialScore: number = 0): Player {
    return {
        id,
        name, // Store the name
        x,
        y,
        angle,
        speed: 2, // Base speed
        color,
        isTurningLeft: false,
        isTurningRight: false,
        turnSpeed: Math.PI / 60, // ~3 degrees per frame
        radius: 5, // Base radius
        path: [{ x, y }], // Start the path with the initial position
        isAlive: true, // Player starts alive
        score: initialScore, // Initialize score
        // --- Trail Hole ---
        isMakingHole: false,
        holeTimer: 0,
        // --- Active Effects ---
        activeEffects: {}, // Initialize as empty object
    };
}

export function updatePlayer(player: Player, keyStates: { [key: string]: boolean }): void {
    // Don't update dead players
    if (!player.isAlive) return;

    const now = performance.now(); // Get current time for checking expiry

    // --- Check for Expired Effects ---
    for (const effectType in player.activeEffects) {
        // Check if the key is actually a PowerupType and if it has expired
        if (player.activeEffects.hasOwnProperty(effectType)) {
            const expiryTime = player.activeEffects[effectType as PowerupType];
            if (expiryTime && now >= expiryTime) {
                console.log(`Effect ${effectType} expired for Player ${player.id}`);
                delete player.activeEffects[effectType as PowerupType];
            }
        }
    }

    // --- Handle Hole Timer --- 
    if (player.isMakingHole) {
        player.holeTimer--;
        if (player.holeTimer <= 0) {
            player.isMakingHole = false;
            console.log(`Player ${player.id} finished making hole.`);
        }
    }

    // --- Randomly Start a Hole (if not already making one) ---
    const HOLE_CHANCE_PER_UPDATE = 0.007; // Make holes more frequent (2% chance per update)
    const HOLE_DURATION_FRAMES = 11;  // Make holes much shorter (8 frames duration)

    if (!player.isMakingHole && Math.random() < HOLE_CHANCE_PER_UPDATE) {
        player.isMakingHole = true;
        player.holeTimer = HOLE_DURATION_FRAMES;
        console.log(`Player ${player.id} started making hole for ${HOLE_DURATION_FRAMES} frames.`);
    }

    // Determine turning based on player controls and keyStates
    const controls = playerControls[player.id];
    let effectiveLeftKey = controls?.left;
    let effectiveRightKey = controls?.right;

    // --- Apply Reverse Controls Effect --- 
    if (player.activeEffects.REVERSE_CONTROLS) {
        effectiveLeftKey = controls?.right; // Swap keys
        effectiveRightKey = controls?.left;
        // Optional: Add visual indicator logic here later
    }

    if (controls) { // Check if controls are defined for this player ID
        player.isTurningLeft = keyStates[effectiveLeftKey ?? ''] || false;
        player.isTurningRight = keyStates[effectiveRightKey ?? ''] || false;
    }

    // Update angle based on turning flags
    if (player.isTurningLeft) {
        player.angle -= player.turnSpeed;
    }
    if (player.isTurningRight) {
        player.angle += player.turnSpeed;
    }

    // Keep angle within 0 to 2*PI range (optional, but good practice)
    player.angle = (player.angle + Math.PI * 2) % (Math.PI * 2);

    // --- Calculate Effective Speed ---
    let currentSpeed = player.speed; // Start with base speed
    if (player.activeEffects.SPEED_BOOST) {
        currentSpeed *= POWERUP_CONSTANTS.SPEED_BOOST.SPEED_MULTIPLIER;
    }
    if (player.activeEffects.SLOW_OTHERS) { // Check if player is affected by SLOW_OTHERS
        currentSpeed *= POWERUP_CONSTANTS.SLOW_OTHERS.SPEED_MULTIPLIER;
    }
    // Add other speed modifiers here if needed

    // Update position based on angle and effective speed
    player.x += Math.cos(player.angle) * currentSpeed;
    player.y += Math.sin(player.angle) * currentSpeed;

    // Add the new position to the path ONLY if not making a hole
    if (!player.isMakingHole) {
        player.path.push({ x: player.x, y: player.y });
    } else {
        // Push null to indicate a break in the trail for drawing purposes
        // Check if the last element isn't already null to avoid consecutive nulls
        if (player.path.length === 0 || player.path[player.path.length - 1] !== null) {
             player.path.push(null);
        }
    }
}

// Returns true if a collision is detected, false otherwise.
export function checkCollisions(
    player: Player,
    playableWidth: number, // Use width of the playable area
    canvasHeight: number,
    allPlayers: Player[] // Add all players for inter-player collision checks
): boolean {
    // --- Invincibility Check ---
    // If the player is currently making a hole OR has INVINCIBLE powerup, they are temporarily invincible.
    if (player.isMakingHole || player.activeEffects.INVINCIBLE) {
        // Optional: Could log this or add visual feedback
        // console.log(`Player ${player.id} is invincible (making hole: ${player.isMakingHole}, powerup: ${!!player.activeEffects.INVINCIBLE}).`);
        return false; // No collision check needed
    }

    // --- Ghost Mode Check ---
    if (player.activeEffects.GHOST_MODE) {
        // console.log(`Player ${player.id} is ghosting.`);
        return false; // No collision check needed
    }

    // --- Boundary Check ---
    if (player.x - player.radius < 0 || 
        player.x + player.radius > playableWidth || // Use playableWidth for right edge
        player.y - player.radius < 0 || 
        player.y + player.radius > canvasHeight) {
        console.log(`Player ${player.id} hit boundary at (${player.x.toFixed(1)}, ${player.y.toFixed(1)})`);
        return true; // Collision detected
    }

    // --- Trail Collision Check (Self and Others) ---
    const skipSegments = 20; // Number of recent path points to ignore for self-collision
    
    for (const otherPlayer of allPlayers) {
        // Check collision against the path of 'otherPlayer'
        for (let i = 0; i < otherPlayer.path.length; i++) {
            // Skip recent segments only when checking against self
            if (player.id === otherPlayer.id && i >= otherPlayer.path.length - skipSegments) {
                continue; 
            }

            const point = otherPlayer.path[i];
            if (!point) continue; 

            const dx = player.x - point.x;
            const dy = player.y - point.y;
            const distanceSquared = dx * dx + dy * dy;
            const collisionThreshold = (player.radius + otherPlayer.radius) * (player.radius + otherPlayer.radius);

            if (distanceSquared < collisionThreshold) {
                console.log(`Player ${player.id} collided with trail of Player ${otherPlayer.id} at point ${i}`);
                return true; // Collision detected
            }
        }
    }

    return false; // No collision detected
}

export function drawPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
    // Don't draw head of dead players
    if (!player.isAlive) return;

    const originalAlpha = ctx.globalAlpha; // Store original alpha
    const originalLineWidth = ctx.lineWidth; // Store original line width

    // --- Apply Visual Effects --- 
    let outerRadius = player.radius + 2; // Radius for effect indicator circle
    let effectColor: string | null = null;
    let setAlpha = false; // Flag if alpha was explicitly set for an effect

    if (player.activeEffects.SPEED_BOOST) {
        effectColor = POWERUP_CONSTANTS.SPEED_BOOST.COLOR;
    }
    if (player.activeEffects.INVINCIBLE || player.isMakingHole) { // Also show for hole invincibility
        effectColor = POWERUP_CONSTANTS.INVINCIBLE.COLOR;
        ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 100) * 0.2; // Simple pulse
        setAlpha = true;
    }
    if (player.activeEffects.SLOW_OTHERS) {
        effectColor = POWERUP_CONSTANTS.SLOW_OTHERS.COLOR;
    }
    if (player.activeEffects.REVERSE_CONTROLS) {
        effectColor = POWERUP_CONSTANTS.REVERSE_CONTROLS.COLOR;
        if (Math.floor(performance.now() / 150) % 2 === 0) {
             effectColor = 'rgba(255, 255, 255, 0.6)'; // Flash white
        }
    }
    // --- New Effect Visuals ---
    if (player.activeEffects.GHOST_MODE) {
        effectColor = POWERUP_CONSTANTS.GHOST_MODE.COLOR;
        ctx.globalAlpha = 0.4; // Make player semi-transparent
        setAlpha = true;
    }
    if (player.activeEffects.THICK_TRAIL) {
        // Visual effect is on the trail itself, but maybe a subtle indicator?
        effectColor = POWERUP_CONSTANTS.THICK_TRAIL.COLOR; 
    }
    // Instantaneous effects don't have visuals here

    // --- Draw Effect Indicator (if any) ---
    if (effectColor) {
        ctx.beginPath();
        ctx.arc(player.x, player.y, outerRadius, 0, Math.PI * 2);
        ctx.fillStyle = effectColor;
        ctx.fill();
        ctx.closePath();
    }

    // --- Draw Player Head ---
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'yellow'; // Always draw head as yellow
    ctx.fill();
    ctx.closePath();

    if (setAlpha) { // Restore alpha only if it was changed by an effect
        ctx.globalAlpha = originalAlpha; 
    }
    ctx.lineWidth = originalLineWidth; // Restore line width just in case
}

// New function to draw the player's trail
export function drawTrail(ctx: CanvasRenderingContext2D, player: Player): void {
    // Always draw the trail, even if the player is dead
    if (player.path.length < 2) return;

    // --- Calculate Effective Trail Width ---
    let effectiveRadius = player.radius;
    if (player.activeEffects.THIN_TRAIL) {
        effectiveRadius *= POWERUP_CONSTANTS.THIN_TRAIL.TRAIL_RADIUS_MULTIPLIER;
        effectiveRadius = Math.max(1, effectiveRadius); 
    }
    if (player.activeEffects.THICK_TRAIL) { // Added check for Thick Trail
        effectiveRadius *= POWERUP_CONSTANTS.THICK_TRAIL.TRAIL_RADIUS_MULTIPLIER;
    }

    ctx.lineWidth = effectiveRadius * 2; // Trail thickness based on effective radius
    ctx.strokeStyle = player.color; // Use player's color for the trail
    ctx.lineCap = 'round'; // Smoother line ends
    ctx.lineJoin = 'round'; // Smoother line joins

    let currentSegmentStarted = false;

    // Iterate through path segments, handling nulls (gaps)
    for (let i = 0; i < player.path.length; i++) {
        const point = player.path[i];

        if (point) {
            // If it's a valid point
            if (!currentSegmentStarted) {
                // Start a new line segment if we weren't already in one
                ctx.beginPath(); 
                ctx.moveTo(point.x, point.y);
                currentSegmentStarted = true;
            } else {
                // Continue the current line segment
                ctx.lineTo(point.x, point.y);
            }
        } else {
            // If it's null (a gap marker)
            if (currentSegmentStarted) {
                // If we were drawing a segment, stroke it now and end it
                ctx.stroke(); 
                currentSegmentStarted = false;
            }
            // Do nothing else for null, effectively creating a gap
        }
    }

    // Stroke any remaining segment that wasn't ended by a null
    if (currentSegmentStarted) {
        ctx.stroke();
    }
} 
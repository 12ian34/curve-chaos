import { createPlayer, updatePlayer, drawPlayer, Player, drawTrail, checkCollisions, getPlayerControls, setPlayerControl, setAllPlayerControls, NAME_LISTS } from './player';
import { Powerup, PowerupType, drawPowerup, POWERUP_CONSTANTS } from './powerup'; // Import powerup stuff
import { loadSettings, saveSettings } from './settings'; // Import settings functions

// --- Constants for Random Start ---
// Minimum turn radius = max_speed / turn_speed_radians_per_frame
// max_speed = 2 (base) * 1.5 (boost) = 3
// turn_speed = Math.PI / 60
const MIN_TURN_RADIUS = 3 / (Math.PI / 60); // Approx 57.3 pixels
const SAFE_ZONE_BUFFER = 2 * MIN_TURN_RADIUS; // Approx 114.6 pixels

console.log('curve chaos - loading...');

// --- Game States ---
type GameState = 'WaitingToStart' | 'Running' | 'GameOver' | 'SessionOver' | 'Paused';
type GameMode = 'Classic' | 'Arcade' | null; // Allow null when no mode is selected

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;

if (!canvas) {
    console.error('Failed to find the canvas element with ID gameCanvas');
    alert('Could not find the game canvas element!');
    throw new Error('Canvas not found'); // Stop execution if canvas is missing
}

const ctx = canvas.getContext('2d');

if (!ctx) {
    console.error('Failed to get 2D context from canvas');
    alert('Could not initialize the game canvas. Your browser might not support it.');
    throw new Error('2D context not available'); // Stop execution if context fails
}

// --- Define Device Pixel Ratio --- 
const dpi = window.devicePixelRatio || 1;

console.log('Canvas context acquired. Initializing game...');

// --- Load Initial Settings ---
const initialSettings = loadSettings();
console.log('Loaded initial settings:', initialSettings);
setAllPlayerControls(initialSettings.controls); // Apply loaded controls

// --- Game State Variables ---
// let player1: Player | null = null; // Replaced by players array
let players: Player[] = []; // Array to hold all player objects
let gameState: GameState = 'WaitingToStart'; // Start in waiting state
let selectedGameMode: GameMode = null; // Start with no mode selected
let activePowerups: Powerup[] = []; // List to hold active powerups
let nextPowerupId = 0; // Simple ID counter
let lastPowerupSpawnTime = 0; // Initialize to 0
const POWERUP_SPAWN_INTERVAL = 3000; // milliseconds (e.g., every 3 seconds)
const POWERUP_RADIUS = 10;
let eliminationOrder: number[] = []; // Array to store player IDs in elimination order

// --- Pause State Variables ---
let pauseStartTime: number | null = null;

// State for key binding process
let waitingForKeyBinding: { playerId: number; direction: 'left' | 'right' } | null = null;
let selectedPlayerCount = initialSettings.playerCount; // Use loaded player count
let lastScores: { [playerId: number]: number } = {}; // Store scores between rounds
let playerNames: { [id: number]: string } = {}; // Store assigned names for the session

// --- Mode Selection Buttons ---
interface Button {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    mode: GameMode;
    radius: number;
}

// --- Key Binding Buttons ---
interface KeyBindButton {
    x: number;
    y: number;
    width: number;
    height: number;
    playerId: number;
    direction: 'left' | 'right';
    text?: string; // Optional text like "Change"
}

// --- Player Count Buttons ---
interface PlayerCountButton {
    x: number;
    y: number;
    width: number;
    height: number;
    action: 'increase' | 'decrease';
    text: string;
}

let modeButtons: Button[] = []; // Buttons need recalculating on resize
let keyBindButtons: KeyBindButton[] = []; // Store key binding buttons here
let playerCountButtons: PlayerCountButton[] = []; // Store player count buttons

// --- Canvas Resizing --- 
function resizeCanvas() {
    if (!canvas || !ctx) return;
    console.log('Resizing canvas...');
    // --- Keep high-resolution backing store --- 
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    // --- Set CSS display size --- 
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    // --- REMOVE the context scaling --- 
    // ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    // Reset buttons so they are recalculated with new dimensions
    modeButtons = []; 
    keyBindButtons = [];
    playerCountButtons = [];
    // Redraw the current state immediately after resize
    drawGameState(ctx, players);
}

// --- Function to Assign Initial Player Names ---
function assignInitialPlayerNames(count: number) {
    playerNames = {}; // Clear previous names
    const nationalities = ['English', 'Norwegian', 'Swedish', 'German'] as (keyof typeof NAME_LISTS)[];
    console.log(`Assigning names for ${count} players...`);
    for (let i = 0; i < count; i++) {
        const playerId = i + 1;
        const nationality = nationalities[i % nationalities.length];
        let randomName = `Player ${playerId}`; // Default name
        if (nationality && NAME_LISTS[nationality]) {
            const nameList = NAME_LISTS[nationality];
            if (nameList.length > 0) {
                randomName = nameList[Math.floor(Math.random() * nameList.length)]!;
            }
        }
        playerNames[playerId] = randomName;
        console.log(` -> Player ${playerId} (${nationality || 'Unknown'}) assigned name: ${randomName}`);
    }
}

// --- Initialization ---
function initializeGame(gameCanvas: HTMLCanvasElement, playerCount: number, previousScores: { [id: number]: number } = {}): Player[] {
    console.log(`Initializing game objects for ${playerCount} players...`);
    console.log('Using previous scores:', previousScores);

    // --- Use client dimensions for layout/spawn calculations --- 
    const w = gameCanvas.clientWidth; // Use clientWidth
    const h = gameCanvas.clientHeight; // Use clientHeight
    const playerColors = ['#ff4d4d', '#4dff4d', '#ff4dff', '#4dffff']; // Use the updated colors

    // Calculate playable width considering leaderboard
    const leaderboardWidth = 250; 
    const padding = 15; 
    const playableWidth = w - leaderboardWidth - (2 * padding); // Based on clientWidth
    console.log(`Client Width: ${w}, Leaderboard: ${leaderboardWidth}, Padding: ${padding}, Playable Width: ${playableWidth}`);

    const newPlayers: Player[] = [];

    // --- Calculate Safe Zone --- (Using playableWidth based on clientWidth)
    let minX = SAFE_ZONE_BUFFER;
    let maxX = playableWidth - SAFE_ZONE_BUFFER; 
    let minY = SAFE_ZONE_BUFFER;
    let maxY = h - SAFE_ZONE_BUFFER; // Based on clientHeight

    // Ensure safe zone is valid (buffer isn't larger than canvas/playable area)
    if (minX >= maxX || minY >= maxY) {
        console.error("Playable area too small for the required safe zone buffer! Players might spawn outside.");
        // Clamp values to prevent negative range
        minX = Math.min(minX, playableWidth / 2);
        maxX = Math.max(maxX, playableWidth / 2);
        minY = Math.min(minY, h / 2);
        maxY = Math.max(maxY, h / 2);
    }

    console.log(`Safe spawn zone: X[${minX.toFixed(1)}-${maxX.toFixed(1)}], Y[${minY.toFixed(1)}-${maxY.toFixed(1)}]`);

    // Define the order of nationalities for players 1-4
    const nationalities = ['English', 'Norwegian', 'Swedish', 'German'] as (keyof typeof NAME_LISTS)[];

    // Create the selected number of players with random starting positions and names
    for (let i = 0; i < playerCount; i++) {
        const color = playerColors[i % playerColors.length]; // Cycle through colors
        if (!color) continue; // Should not happen with playerCount <= 4

        // Generate random positions within the safe zone
        const randomX = Math.random() * (maxX - minX) + minX;
        const randomY = Math.random() * (maxY - minY) + minY;
        const randomAngle = Math.random() * 2 * Math.PI; // Random angle (0 to 2*PI)

        // --- Assign Name ---
        const nationality = nationalities[i % nationalities.length]; // Get nationality based on player index
        let randomName = `Player ${i + 1}`; // Default name
        if (nationality && NAME_LISTS[nationality]) { // Check if nationality and list exist
            const nameList = NAME_LISTS[nationality];
            if (nameList.length > 0) { // Check if list is not empty
                randomName = nameList[Math.floor(Math.random() * nameList.length)]!;
            }
        }

        console.log(`  P${i + 1} (${nationality || 'Unknown'}): Name=${randomName}, Start(x=${randomX.toFixed(1)}, y=${randomY.toFixed(1)}, angle=${(randomAngle * 180 / Math.PI).toFixed(1)}deg)`);

        newPlayers.push(createPlayer(
            i + 1, // Player ID (1-based)
            playerNames[i + 1] || `Player ${i+1}`, // Use pre-assigned name from map
            randomX, // Use random X
            randomY, // Use random Y
            randomAngle, // Use random angle
            color,
            previousScores[i + 1] || 0 // Set initial score from map or default to 0
        ));
    }

    /* --- Old Player Creation Logic ---
    // Player 1 - Top Left
    newPlayers.push(createPlayer(
        1, 
        w * margin, 
        h * margin, 
        Math.PI / 4, // Down-Right
        'blue'
    ));
    // Player 2 - Top Right
    newPlayers.push(createPlayer(
        2, 
        w * (1 - margin), 
        h * margin, 
        (3 * Math.PI) / 4, // Down-Left
        'red'
    ));
    // Player 3 - Bottom Right
    newPlayers.push(createPlayer(
        3,
        w * (1 - margin),
        h * (1 - margin),
        (5 * Math.PI) / 4, // Up-Left
        'green'
    ));
    // Player 4 - Bottom Left
    newPlayers.push(createPlayer(
        4,
        w * margin,
        h * (1 - margin),
        (7 * Math.PI) / 4, // Up-Right
        'yellow'
    ));
    */

    activePowerups = [];
    lastPowerupSpawnTime = 0; 
    nextPowerupId = 0;

    // Reset elimination order for the new round
    eliminationOrder = [];

    console.log('Starting game with mode:', selectedGameMode);
    gameState = 'Running';
    console.log('Game state set to: Running');
    return newPlayers;
}

// --- Input Handling ---
// Store key states for smooth turning
const keyStates: { [key: string]: boolean } = {};

function handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();

    // --- Handle Key Binding --- 
    if (waitingForKeyBinding && gameState === 'WaitingToStart') {
        console.log('Key pressed during binding:', key);
        if (key === 'escape') {
            console.log('Key binding cancelled.');
            waitingForKeyBinding = null;
        } else {
            // --- Prevent binding Space or Enter ---
            if (key === ' ' || key === 'spacebar' || key === 'enter') {
                console.log('Cannot bind Space or Enter key.');
                // Keep waiting for a valid key, maybe add UI feedback later
            } else if (key.length === 1 || key.startsWith('arrow') || key.startsWith('numpad')) {
                const { playerId, direction } = waitingForKeyBinding;
                setPlayerControl(playerId, direction, key);
                waitingForKeyBinding = null;
                // --- Save settings after control change ---
                const currentControlsMap = getPlayerControls();
                const currentControlsArray = Object.values(currentControlsMap); // Convert map to array
                saveSettings({ playerCount: selectedPlayerCount, controls: currentControlsArray });
                console.log('Settings saved after control change.');
            } else {
                console.log('Ignoring unsuitable key for binding:', key);
                // Optionally provide feedback to user? For now, just ignore.
            }
        }
        // Redraw immediately to reflect change or cancellation
        if (ctx) drawGameState(ctx, players);
        return; // Stop further processing
    }

    // --- Handle Space Bar (Start/Pause/Unpause) ---
    if (key === ' ' || key === 'spacebar') { // Handle both spacebar variations
        if (gameState === 'WaitingToStart' && selectedGameMode && !waitingForKeyBinding) {
            console.log('Space pressed, starting game with mode:', selectedGameMode);
            if (canvas && ctx) {
                lastScores = {}; // Reset scores when starting fresh from menu
                players = initializeGame(canvas, selectedPlayerCount, lastScores);
            } else {
                console.error('Cannot start game, canvas or context missing!');
            }
            return;
        } else if (gameState === 'Running') {
            gameState = 'Paused';
            console.log('Game Paused');
            // Record pause start time
            pauseStartTime = performance.now(); 
            if (ctx) drawGameState(ctx, players); // Redraw to show pause screen
            return;
        } else if (gameState === 'Paused') {
            gameState = 'Running';
            console.log('Game Resumed');
            // Handle timer adjustments if pause occurred
            if (pauseStartTime !== null) {
                const pausedDuration = performance.now() - pauseStartTime;
                console.log(`Resuming after paused duration: ${pausedDuration.toFixed(0)} ms`);

                // Adjust player effect timers
                for (const player of players) {
                    for (const effectType in player.activeEffects) {
                        const expiryTime = player.activeEffects[effectType as PowerupType];
                        if (expiryTime) {
                            player.activeEffects[effectType as PowerupType] = expiryTime + pausedDuration;
                        }
                    }
                }

                // Adjust powerup spawn timestamps (to extend lifetime)
                for (const powerup of activePowerups) {
                    powerup.createdAt += pausedDuration;
                }
                
                // Adjust the global powerup spawn timer
                lastPowerupSpawnTime += pausedDuration;

                pauseStartTime = null; // Reset pause start time
            }
            // No need to redraw immediately, gameLoop will take over
            return;
        }
    }

    // --- Handle Enter Key (Restart Round / Return to Menu) ---
    if (key === 'enter') {
        if (gameState === 'GameOver') {
            console.log('Enter pressed, restarting round...');
            if (canvas && ctx) {
                // Pass the lastScores map to preserve scores across rounds
                players = initializeGame(canvas, selectedPlayerCount, lastScores);
            } else {
                console.error('Cannot restart game, canvas or context missing!');
            }
            return;
        } else if (gameState === 'SessionOver') {
            console.log('Enter pressed, returning to main menu...');
            // Reset to initial state
            gameState = 'WaitingToStart';
            lastScores = {}; // Clear scores completely
            players = []; // Clear players array
            assignInitialPlayerNames(selectedPlayerCount); // Re-assign names for the new session
            // selectedGameMode = null; // Optionally deselect mode
            // Redraw the WaitingToStart screen
            if (ctx) drawGameState(ctx, players);
            return;
        }
    }

    // --- Normal Key State Update (for turning) ---
    keyStates[key] = true;
}

function handleKeyUp(event: KeyboardEvent) {
    keyStates[event.key.toLowerCase()] = false; // Clear key state

    // // Handle player controls only if running (Moved to updatePlayer)
    // if (gameState !== 'Running' || !player1) return;
    // ... removed old single-player keyup logic ...
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

console.log('Input listeners added.');

// --- Mouse Click Handling for Buttons ---
function handleMouseClick(event: MouseEvent) {
    if (gameState !== 'WaitingToStart' || !canvas || !ctx) return; // Added ctx check

    const rect = canvas.getBoundingClientRect(); // Use canvas directly
    // --- Calculate mouse position relative to CSS pixels --- 
    const mouseX_css = event.clientX - rect.left;
    const mouseY_css = event.clientY - rect.top;
    // --- Scale mouse coordinates to match canvas internal resolution --- 
    const mouseX = mouseX_css * dpi;
    const mouseY = mouseY_css * dpi;

    // Check mode buttons first
    // Ensure buttons are calculated before checking clicks
    // if (modeButtons.length === 0) { // Calculation now happens in drawGameState
    //     calculateButtonLayout(canvas.width, canvas.height);
    // }
    let buttonClicked = false;
    for (const button of modeButtons) {
        if (
            mouseX >= button.x &&
            mouseX <= button.x + button.width &&
            mouseY >= button.y &&
            mouseY <= button.y + button.height
        ) {
            selectedGameMode = button.mode;
            console.log('Selected game mode:', selectedGameMode);
            buttonClicked = true;
            break;
        }
    }

    // Check key bind buttons if no mode button was clicked
    if (!buttonClicked) {
        for (const button of keyBindButtons) { 
            if (
                mouseX >= button.x &&
                mouseX <= button.x + button.width &&
                mouseY >= button.y &&
                mouseY <= button.y + button.height
            ) {
                waitingForKeyBinding = { playerId: button.playerId, direction: button.direction };
                console.log(`Waiting for key bind: Player ${button.playerId}, Direction: ${button.direction}`);
                buttonClicked = true;
                break;
            }
        }
    }

    // Check player count buttons if no other button was clicked
    if (!buttonClicked) {
        for (const button of playerCountButtons) {
            if (
                mouseX >= button.x &&
                mouseX <= button.x + button.width &&
                mouseY >= button.y &&
                mouseY <= button.y + button.height
            ) {
                let countChanged = false;
                if (button.action === 'increase' && selectedPlayerCount < 4) {
                    selectedPlayerCount++;
                    countChanged = true;
                    console.log('Increased player count to:', selectedPlayerCount);
                    assignInitialPlayerNames(selectedPlayerCount); // Re-assign names
                } else if (button.action === 'decrease' && selectedPlayerCount > 1) {
                    selectedPlayerCount--;
                    countChanged = true;
                    console.log('Decreased player count to:', selectedPlayerCount);
                    assignInitialPlayerNames(selectedPlayerCount); // Re-assign names
                }
                if (countChanged) {
                     // --- Save settings after player count change ---
                    const currentControlsMap = getPlayerControls();
                    const currentControlsArray = Object.values(currentControlsMap); // Convert map to array
                    saveSettings({ playerCount: selectedPlayerCount, controls: currentControlsArray });
                    console.log('Settings saved after player count change.');
                }
                buttonClicked = true;
                break;
            }
        }
    }

    // Redraw state immediately if any button was clicked
    if (buttonClicked) {
        drawGameState(ctx, players); 
    }
}

document.addEventListener('click', handleMouseClick);
window.addEventListener('resize', resizeCanvas); // Add resize listener

// --- Powerup Spawning ---
function spawnPowerup(context: CanvasRenderingContext2D): void {
    // --- Use client dimensions for spawn area calculation ---
    const canvasWidth = context.canvas.clientWidth; // Use clientWidth
    const canvasHeight = context.canvas.clientHeight; // Use clientHeight
    const leaderboardWidth = 250; 
    const padding = 15; 
    const playableWidth = canvasWidth - leaderboardWidth - (2 * padding); // Based on clientWidth
    const margin = POWERUP_RADIUS * 2; // Keep away from edges

    // TODO: Add check to prevent spawning on trails
    const spawnX = Math.random() * (playableWidth - margin * 2) + margin; // Use playableWidth
    const spawnY = Math.random() * (canvasHeight - margin * 2) + margin; // Use clientHeight

    // Select a random powerup type
    const powerupTypes: PowerupType[] = [
        'SPEED_BOOST', 
        'SLOW_OTHERS', 
        'THIN_TRAIL', 
        'INVINCIBLE', 
        'REVERSE_CONTROLS',
        // --- Include New Powerups ---
        'GHOST_MODE',
        'THICK_TRAIL',
        'CLEAR_OWN_TRAIL',
        'RANDOM_TELEPORT'
    ];
    const randomIndex = Math.floor(Math.random() * powerupTypes.length);
    const type = powerupTypes[randomIndex]!;

    const newPowerup: Powerup = {
        id: nextPowerupId++,
        type,
        x: spawnX,
        y: spawnY,
        radius: POWERUP_CONSTANTS.DEFAULT_RADIUS, // Use constant
        createdAt: performance.now(), // Use performance.now() consistent with requestAnimationFrame
        // duration: type === 'INVINCIBLE' || type === 'THIN_TRAIL' || type === 'REVERSE_CONTROLS' ? 5000 : undefined, // Example duration for timed ones
    };

    activePowerups.push(newPowerup);
    console.log(`Spawned powerup: ${newPowerup.type} at (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)})`);
}

// --- Function to Apply Powerup Effects ---
function applyPowerupEffect(player: Player, powerup: Powerup, allPlayers: Player[]): void {
    const now = performance.now();
    const effectType = powerup.type;
    let duration = 0;

    console.log(`Applying effect ${effectType} to Player ${player.id}`);

    switch (effectType) {
        case 'SPEED_BOOST':
            duration = POWERUP_CONSTANTS.SPEED_BOOST.DURATION_MS;
            // Store expiry time
            player.activeEffects[effectType] = now + duration;
            break;

        case 'INVINCIBLE':
            duration = POWERUP_CONSTANTS.INVINCIBLE.DURATION_MS;
            player.activeEffects[effectType] = now + duration;
            break;

        case 'THIN_TRAIL':
            duration = POWERUP_CONSTANTS.THIN_TRAIL.DURATION_MS;
            player.activeEffects[effectType] = now + duration;
            break;

        case 'REVERSE_CONTROLS':
            duration = POWERUP_CONSTANTS.REVERSE_CONTROLS.DURATION_MS;
            player.activeEffects[effectType] = now + duration;
            break;
        
        case 'SLOW_OTHERS':
            duration = POWERUP_CONSTANTS.SLOW_OTHERS.DURATION_MS;
            // Apply effect to all *other* living players
            for (const otherPlayer of allPlayers) {
                if (otherPlayer.id !== player.id && otherPlayer.isAlive) {
                    otherPlayer.activeEffects[effectType] = now + duration;
                    console.log(` -> Also applying ${effectType} to Player ${otherPlayer.id}`);
                }
            }
            // Note: The collecting player doesn't get the SLOW_OTHERS effect directly added to their map
            break;
        
        // --- Handle New Powerup Effects ---
        case 'GHOST_MODE':
            duration = POWERUP_CONSTANTS.GHOST_MODE.DURATION_MS;
            player.activeEffects[effectType] = now + duration;
            break;

        case 'THICK_TRAIL':
            duration = POWERUP_CONSTANTS.THICK_TRAIL.DURATION_MS;
            player.activeEffects[effectType] = now + duration;
            break;

        case 'CLEAR_OWN_TRAIL':
            // Instantaneous: Clear the player's path array
            console.log(` -> Clearing trail for Player ${player.id}. Old length: ${player.path.length}`);
            player.path = [player.path[player.path.length - 1] || { x: player.x, y: player.y }]; // Keep only the last point (or current pos if path is empty)
            console.log(` -> New trail length: ${player.path.length}`);
            break;

        case 'RANDOM_TELEPORT':
            // Instantaneous: Move player to a new random safe spot
            console.log(` -> Teleporting Player ${player.id}`);
            // --- Use client dimensions for teleport calculation ---
            const canvasWidth = ctx?.canvas.clientWidth ?? 800; // Use clientWidth (fallback needed?)
            const canvasHeight = ctx?.canvas.clientHeight ?? 600; // Use clientHeight
            const leaderboardWidth = 250; 
            const padding = 15; 
            const playableWidth = canvasWidth - leaderboardWidth - (2 * padding); // Based on clientWidth
            
            let minX = SAFE_ZONE_BUFFER;
            let maxX = playableWidth - SAFE_ZONE_BUFFER;
            let minY = SAFE_ZONE_BUFFER;
            let maxY = canvasHeight - SAFE_ZONE_BUFFER;

            // Clamp if necessary (same logic as initializeGame)
            if (minX >= maxX || minY >= maxY) {
                minX = Math.min(minX, playableWidth / 2);
                maxX = Math.max(maxX, playableWidth / 2);
                minY = Math.min(minY, canvasHeight / 2);
                maxY = Math.max(maxY, canvasHeight / 2);
            }

            const newX = Math.random() * (maxX - minX) + minX;
            const newY = Math.random() * (maxY - minY) + minY;
            console.log(`    -> Teleported from (${player.x.toFixed(1)}, ${player.y.toFixed(1)}) to (${newX.toFixed(1)}, ${newY.toFixed(1)})`);
            player.x = newX;
            player.y = newY;
            // Optionally, reset the last path point to the new location to avoid a long line
            player.path[player.path.length - 1] = { x: newX, y: newY };
            break;
        
        // Add cases for other powerups here if needed
    }

    // Optional: Add visual/audio feedback for powerup collection
}

// --- Game Loop ---
function gameLoop(timestamp: number, context: CanvasRenderingContext2D, currentPlayers: Player[] | null) {
    // --- Pause Check --- 
    if (gameState === 'Paused') {
        // If paused, just request the next frame without updating or drawing over the pause screen
        requestAnimationFrame((ts) => gameLoop(ts, context, currentPlayers)); 
        return; // Skip the rest of the loop
    }

    // --- Use client dimensions for boundary checks/playable area --- 
    const canvasWidth = context.canvas.clientWidth; // Use clientWidth
    const canvasHeight = context.canvas.clientHeight; // Use clientHeight
    const leaderboardWidth = 250; 
    const padding = 15; 
    const playableWidth = canvasWidth - leaderboardWidth - (2 * padding); // Based on clientWidth

    // Initialize spawn timer on first frame if needed
    if (lastPowerupSpawnTime === 0 && gameState === 'Running') {
        lastPowerupSpawnTime = timestamp; 
    }

    // --- Handle Powerup Lifetimes (Arcade Mode Only) ---
    if (gameState === 'Running' && selectedGameMode === 'Arcade') {
        const now = performance.now(); // Use consistent time source
        const previousCount = activePowerups.length;
        activePowerups = activePowerups.filter(powerup => 
            now - powerup.createdAt < POWERUP_CONSTANTS.DEFAULT_LIFETIME_MS
        );
        if (activePowerups.length < previousCount) {
            console.log(`Despawned ${previousCount - activePowerups.length} powerup(s) due to lifetime.`);
        }
    }

    // --- Spawn Powerups (Arcade Mode Only) ---
    if (gameState === 'Running' && selectedGameMode === 'Arcade') {
        // Use timestamp consistently
        if (timestamp - lastPowerupSpawnTime > POWERUP_SPAWN_INTERVAL) {
            spawnPowerup(context);
            lastPowerupSpawnTime = timestamp; // Reset timer using the current frame timestamp
        }
    }

    // --- Update (only if running) ---
    if (gameState === 'Running' && currentPlayers) {
        let livingPlayersCount = 0;
        const collectedPowerupIds = new Set<number>(); // Track IDs of powerups collected this frame

        for (const player of currentPlayers) {
            // Pass keyStates to updatePlayer
            updatePlayer(player, keyStates);

            // Check collisions only for living players
            if (player.isAlive) {
                // --- Check Player-Trail/Boundary Collisions ---
                const collisionDetected = checkCollisions(
                    player,
                    playableWidth, // Pass playableWidth (now based on clientWidth)
                    canvasHeight, // Pass clientHeight
                    currentPlayers // Pass the full list of players
                );
                if (collisionDetected) {
                    player.isAlive = false;
                    console.log(`Player ${player.id} is out!`);
                    eliminationOrder.push(player.id);
                    console.log('Elimination order:', eliminationOrder);
                } else {
                    // --- Check Player-Powerup Collisions (only if player didn't die) ---
                    if (selectedGameMode === 'Arcade') {
                        for (const powerup of activePowerups) {
                            if (collectedPowerupIds.has(powerup.id)) continue; // Already collected this frame

                            const dx = player.x - powerup.x;
                            const dy = player.y - powerup.y;
                            const distanceSquared = dx * dx + dy * dy;
                            const collisionThreshold = (player.radius + powerup.radius) * (player.radius + powerup.radius);

                            if (distanceSquared < collisionThreshold) {
                                console.log(`Player ${player.id} collected powerup ${powerup.id} (${powerup.type})`);
                                // Mark for removal (don't modify array while iterating)
                                collectedPowerupIds.add(powerup.id);
                                // TODO: Apply effect in next task (8d/8e/8f)
                                // Apply the effect immediately
                                applyPowerupEffect(player, powerup, currentPlayers);
                            }
                        }
                    }
                }
            }

            // Count living players after potential collision
            if (player.isAlive) {
                livingPlayersCount++;
            }
        }

        // --- Remove Collected Powerups --- 
        if (collectedPowerupIds.size > 0) {
            const previousCount = activePowerups.length;
            activePowerups = activePowerups.filter(powerup => !collectedPowerupIds.has(powerup.id));
            console.log(`Removed ${previousCount - activePowerups.length} collected powerup(s).`);
        }

        // Check for Game Over condition (1 or 0 players left)
        if (livingPlayersCount <= 1 && currentPlayers.length > 1) { // Ensure there were >1 players initially
            // --- Round End Logic --- 
            // lastScores = {}; // Reset for the new round's scores - We'll populate this AFTER calculating scores
            
            // Determine Rank Order
            const livingPlayerIds = currentPlayers.filter(p => p.isAlive).map(p => p.id);
            // Full ranking: survivors first, then the eliminated players in reverse order
            const finalRanking = [...livingPlayerIds, ...eliminationOrder.slice().reverse()];
            console.log('Round end ranking (first is best):', finalRanking);

            // Award Points based on Rank (3/2/1/0)
            const pointsAwarded = [3, 2, 1, 0]; // Points for 1st, 2nd, 3rd, 4th+
            finalRanking.forEach((playerId, index) => {
                const player = currentPlayers.find(p => p.id === playerId);
                if (player) {
                    const points = pointsAwarded[index] ?? 0; // Get points or 0 if rank > 4
                    player.score += points;
                    console.log(`Awarded ${points} points to Player ${player.id}. New score: ${player.score}`);
                }
            });
            
            // --- Deprecated Winner Score Logic ---
            // const winner = currentPlayers.find(p => p.isAlive);
            // if (winner) {
            //     winner.score++;
            //     console.log(`Player ${winner.id} wins the round! New score: ${winner.score}`);
            // }
            
            // Store final scores for the next round/session end check
            lastScores = {}; // Clear before populating
            currentPlayers.forEach(p => {
                lastScores[p.id] = p.score;
            });
            console.log('Final scores after round:', lastScores);

            // --- Check for Session Win Condition --- 
            // Use the updated scores directly from the players array or lastScores map
            const scores = Object.values(lastScores).sort((a, b) => b - a); // Sort scores descending
            const highestScore = scores[0] ?? 0;
            const secondHighestScore = scores[1] ?? 0; // Will be undefined if only 1 player, handle below
            const WIN_SCORE = 30; // Target score
            const WIN_DIFFERENCE = 2; // Required difference

            // Check win condition: Need >= WIN_SCORE AND (either only 1 player OR win by >= WIN_DIFFERENCE)
            if (highestScore >= WIN_SCORE && (scores.length < 2 || highestScore >= secondHighestScore + WIN_DIFFERENCE)) {
                gameState = 'SessionOver';
                console.log(`Session Over! Player with score ${highestScore} wins the game! (Scores: ${scores.join(', ')})`);
                 // Draw Session Over screen immediately after state change
                 if (ctx) drawGameState(ctx, players);
            } else {
                gameState = 'GameOver';
                console.log('Round Over! Starting next round setup. (Scores: ', lastScores, ')');
                 // Draw Game Over screen immediately after state change
                 if (ctx) drawGameState(ctx, players);
            }
        }

        // --- Draw Running Game Screen (Only if still Running) --- 
        if (gameState === 'Running') { // Add this check
            drawRunningGameScreen(context, currentPlayers);
        }
    }

    // --- Draw (General - Now mostly handled by state-specific calls) ---
    // The main game elements are drawn above IF the state is Running.
    // Overlays/Menus for other states (WaitingToStart, Paused, GameOver, SessionOver) 
    // are drawn via direct calls to drawGameState() when those states are entered 
    // or initially on load.

    // Request the next frame
    requestAnimationFrame((ts) => gameLoop(ts, context, players));
}

// --- Function to draw the persistent leaderboard --- 
function drawLeaderboard(ctx: CanvasRenderingContext2D, players: Player[]) {
    // --- Use client dimensions for CSS layout --- 
    const canvasWidth_css = ctx.canvas.clientWidth; // Use clientWidth
    const canvasHeight_css = ctx.canvas.clientHeight; // Use clientHeight
    const leaderboardWidth_css = 250; 
    const padding_css = 15;
    const leaderboardX_css = canvasWidth_css - leaderboardWidth_css - padding_css; 
    const leaderboardY_css = padding_css;
    const leaderboardHeight_css = canvasHeight_css - 2 * padding_css; 
    const lineHeight_css = 30; 
    const titleFontSize_css = 24; 
    const scoreFontSize_css = 20; 
    const defaultFont = "'Poppins', sans-serif"; // Define font family

    // --- Calculate scaled values ---
    const leaderboardX_scaled = leaderboardX_css * dpi;
    const leaderboardY_scaled = leaderboardY_css * dpi;
    const leaderboardWidth_scaled = leaderboardWidth_css * dpi;
    const leaderboardHeight_scaled = leaderboardHeight_css * dpi;
    const padding_scaled = padding_css * dpi;
    const lineHeight_scaled = lineHeight_css * dpi;
    const titleFontSize_scaled = titleFontSize_css * dpi;
    const scoreFontSize_scaled = scoreFontSize_css * dpi;
    const borderRadius_scaled = 10 * dpi;
    const insetBorderRadius_scaled = 9 * dpi;

    // Draw semi-transparent background gradient
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.75; // Slightly more opaque
    const bgGradient = ctx.createLinearGradient(leaderboardX_scaled, leaderboardY_scaled, leaderboardX_scaled, leaderboardY_scaled + leaderboardHeight_scaled);
    bgGradient.addColorStop(0, '#3a3a3a'); 
    bgGradient.addColorStop(1, '#1a1a1a'); 
    ctx.fillStyle = bgGradient;
    drawRoundedRect(ctx, leaderboardX_scaled, leaderboardY_scaled, leaderboardWidth_scaled, leaderboardHeight_scaled, borderRadius_scaled);
    ctx.fill();

    // Add a subtle inner border/highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; 
    // --- Scale Line Width & coords --- 
    ctx.lineWidth = 1 * dpi;
    drawRoundedRect(ctx, leaderboardX_scaled + 1 * dpi, leaderboardY_scaled + 1 * dpi, leaderboardWidth_scaled - 2 * dpi, leaderboardHeight_scaled - 2 * dpi, insetBorderRadius_scaled); // Scale inset border
    ctx.stroke();

    ctx.globalAlpha = previousAlpha; // Restore alpha before text

    // Draw Title
    ctx.fillStyle = '#ffffff'; // White title
    // --- Scale Font Size & Position --- 
    ctx.font = `bold ${titleFontSize_scaled}px ${defaultFont}`; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top'; // Align text from the top
    const titleX_scaled = leaderboardX_scaled + leaderboardWidth_scaled / 2;
    const titleY_scaled = leaderboardY_scaled + padding_scaled;
    ctx.fillText('Scores', titleX_scaled, titleY_scaled);

    // Sort players by score (highest first)
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    // Draw Scores
    // --- Scale Font Size & Position --- 
    ctx.font = `bold ${scoreFontSize_scaled}px ${defaultFont}`; 
    ctx.textAlign = 'left';
    const scoreStartX_scaled = leaderboardX_scaled + padding_scaled + 10 * dpi; // Scale indent
    let currentY_scaled = titleY_scaled + titleFontSize_scaled + padding_scaled * 1.5; // Start below title (scaled)

    for (let i = 0; i < sortedPlayers.length; i++) {
        const player = sortedPlayers[i];
        if (!player) continue; // Safety check
        // --- Check against scaled height --- 
        if (currentY_scaled + scoreFontSize_scaled > leaderboardY_scaled + leaderboardHeight_scaled - padding_scaled) {
            break; // Stop if we run out of space
        }
        // Use player color
        ctx.fillStyle = player.color;
        const scoreText = `${player.name}: ${player.score}`; // Use name instead of P<id>
        // --- Draw at scaled position --- 
        ctx.fillText(scoreText, scoreStartX_scaled, currentY_scaled);

        // Clear shadow for next entry (No longer strictly necessary but harmless)
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        currentY_scaled += lineHeight_scaled; // Increment scaled Y
    }
    // Reset alignment/baseline if needed elsewhere
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle'; 
}

// --- Helper Function for Rounded Rectangles ---
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

// --- Helper to draw the current game screen (used by Running and Paused states) ---
function drawRunningGameScreen(context: CanvasRenderingContext2D, currentPlayers: Player[] | null) {
    // --- Use client dimensions for CSS layout --- 
    const canvasWidth_css = context.canvas.clientWidth; // Use clientWidth
    const canvasHeight_css = context.canvas.clientHeight; // Use clientHeight
    const leaderboardWidth_css = 250; 
    const padding_css = 15; 
    const playableWidth_css = canvasWidth_css - leaderboardWidth_css - (2 * padding_css); 
    
    // --- Calculate scaled values --- 
    const canvasWidth_scaled = canvasWidth_css * dpi;
    const canvasHeight_scaled = canvasHeight_css * dpi;
    const playableWidth_scaled = playableWidth_css * dpi;
    const playableHeight_scaled = canvasHeight_scaled; // Height isn't reduced by leaderboard

    // Draw Background Gradient
    const gradient = context.createLinearGradient(0, 0, 0, canvasHeight_scaled); // Use scaled height
    gradient.addColorStop(0, '#1a0a2a'); 
    gradient.addColorStop(1, '#0a0a0a'); 
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvasWidth_scaled, canvasHeight_scaled); // Use scaled dimensions

    // Draw Playable Area Border
    context.strokeStyle = 'rgba(200, 200, 200, 0.5)'; 
    // --- Scale Line Width --- 
    context.lineWidth = 2 * dpi; 
    context.strokeRect(1 * dpi, 1 * dpi, playableWidth_scaled - 2 * dpi, playableHeight_scaled - 2 * dpi); // Use scaled coords/dimensions

    // Draw Trails
    if (currentPlayers) {
        for (const player of currentPlayers) {
            // --- Pass DPI to drawTrail if it needs scaling --- 
            // Assuming drawTrail handles scaling internally or takes scaled values
            drawTrail(context, player); // Might need update if drawTrail isn't scaling
        }
    }

    // Draw Powerups (always draw if they exist, even if paused)
    // This ensures they don't disappear when pausing
    for (const powerup of activePowerups) {
        // --- Pass DPI to drawPowerup if it needs scaling --- 
        // Assuming drawPowerup handles scaling internally or takes scaled values
        drawPowerup(context, powerup); // Might need update if drawPowerup isn't scaling
    }

    // Draw Player Heads
    if (currentPlayers) {
        for (const player of currentPlayers) {
            if (player.isAlive) { 
                 // --- Pass DPI to drawPlayer if it needs scaling --- 
                 // Assuming drawPlayer handles scaling internally or takes scaled values
                drawPlayer(context, player); // Might need update if drawPlayer isn't scaling
            }
        }
    }
    // Draw Leaderboard (always draw)
    // drawLeaderboard now handles its own scaling
    drawLeaderboard(context, players);
}

// --- Draw Game State Function ---
function drawGameState(context: CanvasRenderingContext2D, currentPlayers: Player[] | null) {
    // --- Use client dimensions for CSS layout, but scale drawing by DPI --- 
    const displayWidth = context.canvas.clientWidth; // CSS width
    const displayHeight = context.canvas.clientHeight; // CSS height
    // const canvasWidth = context.canvas.width; // Internal width (displayWidth * dpi)
    // const canvasHeight = context.canvas.height; // Internal height (displayHeight * dpi)

    const currentControls = getPlayerControls(); // Get current controls
    const defaultFont = "'Poppins', sans-serif"; // Define font family

    // This function now PRIMARILY handles drawing OVERLAYS or specific state screens,
    // NOT the main running game screen (that's drawRunningGameScreen).

    // Reset button arrays for recalculation (only for WaitingToStart)
    if (gameState === 'WaitingToStart') {
        modeButtons = [];
        keyBindButtons = []; 
        playerCountButtons = []; // Reset player count buttons too
        // --- Button Calculation moved inside WaitingToStart block ---
        // No separate calculateButtonLayout needed for this screen anymore
    }

    context.textAlign = 'center';
    context.textBaseline = 'middle'; 
    const centerX = displayWidth / 2;
    const centerY = displayHeight / 2;

    // Clear canvas before drawing states (except for Running/Paused which draw their own background)
    if (gameState !== 'Running' && gameState !== 'Paused') {
        context.clearRect(0, 0, displayWidth * dpi, displayHeight * dpi);
        // Optionally draw the default background for non-running states?
        const bgGradient = context.createLinearGradient(0, 0, 0, displayHeight * dpi); // Scale gradient height
        bgGradient.addColorStop(0, '#1a0a2a');
        bgGradient.addColorStop(1, '#0a0a0a');
        context.fillStyle = bgGradient;
        context.fillRect(0, 0, displayWidth * dpi, displayHeight * dpi); // Scale fill rect
    }

    if (gameState === 'WaitingToStart') {
        context.fillStyle = '#eee'; // Brighter text
        // --- Scale Font Size --- 
        context.font = `bold ${48 * dpi}px ${defaultFont}`; 
        
        const scaledCenterX = displayWidth / 2; // Center based on CSS pixels
        const scaledCenterY = displayHeight / 2; // Center based on CSS pixels

        // --- Layout Constants (CSS Pixels) ---
        const sectionSpacing_css = 50; 
        let currentY_css = scaledCenterY - displayHeight * 0.35; 
        if (currentY_css < 60) currentY_css = 60; 

        // --- 1. Title ---
        // --- Scale coordinates and font size --- 
        context.fillText('Select Game Mode', scaledCenterX * dpi, currentY_css * dpi);
        currentY_css += 70; // Space after title (CSS pixels)

        // --- 2. Draw Player Count Selection (Improved Layout) ---
        // --- Define dimensions in CSS pixels, scale when drawing --- 
        const pcBtnWidth_css = 45;
        const pcBtnHeight_css = 35;
        const pcBtnRadius_css = 8;
        const pcTextWidth_css = 160; 
        const pcSpacing_css = 15; 
        const pcTotalWidth_css = pcBtnWidth_css * 2 + pcTextWidth_css + pcSpacing_css * 2;
        const pcStartX_css = scaledCenterX - pcTotalWidth_css / 2;
        const playerCountY_css = currentY_css; 

        // --- Scale Font Size --- 
        context.font = `bold ${24 * dpi}px ${defaultFont}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Decrease Button
        // --- Scale gradient coords, draw coords, dimensions, radius --- 
        const pcBtnX_scaled = pcStartX_css * dpi;
        const pcBtnY_scaled = (playerCountY_css - pcBtnHeight_css / 2) * dpi;
        const pcBtnWidth_scaled = pcBtnWidth_css * dpi;
        const pcBtnHeight_scaled = pcBtnHeight_css * dpi;
        const pcBtnRadius_scaled = pcBtnRadius_css * dpi;

        const btnGradientMinus = context.createLinearGradient(pcBtnX_scaled, pcBtnY_scaled, pcBtnX_scaled, pcBtnY_scaled + pcBtnHeight_scaled);
        btnGradientMinus.addColorStop(0, '#5a5a5a'); btnGradientMinus.addColorStop(1, '#444444');
        context.fillStyle = btnGradientMinus;
        drawRoundedRect(context, pcBtnX_scaled, pcBtnY_scaled, pcBtnWidth_scaled, pcBtnHeight_scaled, pcBtnRadius_scaled);
        context.fill();
        context.fillStyle = 'white';
        context.strokeStyle = '#777';
        // --- Scale Line Width --- 
        context.lineWidth = 1 * dpi;
        drawRoundedRect(context, pcBtnX_scaled, pcBtnY_scaled, pcBtnWidth_scaled, pcBtnHeight_scaled, pcBtnRadius_scaled);
        context.stroke();
        // --- Scale Text Position --- 
        context.fillText('-', pcStartX_css * dpi + pcBtnWidth_scaled / 2, playerCountY_css * dpi);
        // --- Store SCALED button coordinates/dimensions --- 
        playerCountButtons.push({ x: pcBtnX_scaled, y: pcBtnY_scaled, width: pcBtnWidth_scaled, height: pcBtnHeight_scaled, action: 'decrease', text: '-' });
        
        // Player Count Text
        context.fillStyle = '#ddd';
        // --- Scale Font Size & Position --- 
        context.font = ` ${22 * dpi}px ${defaultFont}`; 
        context.fillText(`Players: ${selectedPlayerCount}`, (pcStartX_css + pcBtnWidth_css + pcSpacing_css + pcTextWidth_css / 2) * dpi, playerCountY_css * dpi);
        
        // Increase Button
        // --- Calculate & Scale coords, dimensions, radius --- 
        const increaseBtnX_css = pcStartX_css + pcBtnWidth_css + pcSpacing_css + pcTextWidth_css + pcSpacing_css;
        const increaseBtnX_scaled = increaseBtnX_css * dpi;
        // pcBtnY_scaled, pcBtnWidth_scaled, pcBtnHeight_scaled, pcBtnRadius_scaled are the same

        const btnGradientPlus = context.createLinearGradient(increaseBtnX_scaled, pcBtnY_scaled, increaseBtnX_scaled, pcBtnY_scaled + pcBtnHeight_scaled);
        btnGradientPlus.addColorStop(0, '#5a5a5a'); btnGradientPlus.addColorStop(1, '#444444');
        context.fillStyle = btnGradientPlus;
        drawRoundedRect(context, increaseBtnX_scaled, pcBtnY_scaled, pcBtnWidth_scaled, pcBtnHeight_scaled, pcBtnRadius_scaled);
        context.fill();
        context.fillStyle = 'white';
        context.strokeStyle = '#777';
        // --- Scale Line Width --- 
        context.lineWidth = 1 * dpi;
        drawRoundedRect(context, increaseBtnX_scaled, pcBtnY_scaled, pcBtnWidth_scaled, pcBtnHeight_scaled, pcBtnRadius_scaled);
        context.stroke();
        // --- Scale Font Size & Position --- 
        context.font = `bold ${24 * dpi}px ${defaultFont}`; 
        context.fillText('+', increaseBtnX_scaled + pcBtnWidth_scaled / 2, playerCountY_css * dpi);
         // --- Store SCALED button coordinates/dimensions --- 
        playerCountButtons.push({ x: increaseBtnX_scaled, y: pcBtnY_scaled, width: pcBtnWidth_scaled, height: pcBtnHeight_scaled, action: 'increase', text: '+' });

        currentY_css += pcBtnHeight_css / 2 + sectionSpacing_css; // Move down (CSS pixels)

        // --- 3. Draw Mode Buttons ---
        // --- Define dimensions in CSS pixels, scale when drawing --- 
        const modeBtnWidth_css = 180;
        const modeBtnHeight_css = 60;
        const modeBtnRadius_css = 15;
        const modeSpacing_css = 40;
        const modeTotalWidth_css = modeBtnWidth_css * 2 + modeSpacing_css;
        const modeStartX_css = scaledCenterX - modeTotalWidth_css / 2;
        const modeBtnY_css = currentY_css;

        // --- Calculate scaled values --- 
        const modeBtnWidth_scaled = modeBtnWidth_css * dpi;
        const modeBtnHeight_scaled = modeBtnHeight_css * dpi;
        const modeBtnRadius_scaled = modeBtnRadius_css * dpi;
        const modeSpacing_scaled = modeSpacing_css * dpi;
        const modeStartX_scaled = modeStartX_css * dpi;
        const modeBtnY_scaled = modeBtnY_css * dpi;

        // --- Define buttons with SCALED coordinates/dimensions --- 
        modeButtons = [
            { x: modeStartX_scaled, y: modeBtnY_scaled, width: modeBtnWidth_scaled, height: modeBtnHeight_scaled, text: 'Classic', mode: 'Classic' as GameMode, radius: modeBtnRadius_scaled },
            { x: modeStartX_scaled + modeBtnWidth_scaled + modeSpacing_scaled, y: modeBtnY_scaled, width: modeBtnWidth_scaled, height: modeBtnHeight_scaled, text: 'Arcade', mode: 'Arcade' as GameMode, radius: modeBtnRadius_scaled },
        ];

        for (const button of modeButtons) {
            const isSelected = selectedGameMode === button.mode;
            // Background Gradient (use scaled coords/dimensions)
            const btnGradient = context.createLinearGradient(button.x, button.y, button.x, button.y + button.height);
            if (isSelected) {
                btnGradient.addColorStop(0, '#008800'); 
                btnGradient.addColorStop(1, '#005500'); 
            } else {
                btnGradient.addColorStop(0, '#5a5a5a');
                btnGradient.addColorStop(1, '#444444'); 
            }
            context.fillStyle = btnGradient;
            // --- Use scaled values from button object --- 
            drawRoundedRect(context, button.x, button.y, button.width, button.height, button.radius);
            context.fill();

            // Border
            context.strokeStyle = isSelected ? '#44ff44' : '#777'; 
            // --- Scale Line Width --- 
            context.lineWidth = (isSelected ? 2 : 1) * dpi; 
            drawRoundedRect(context, button.x, button.y, button.width, button.height, button.radius);
            context.stroke();
            context.lineWidth = 1 * dpi; // Reset line width

            // Text
            context.fillStyle = isSelected ? 'white' : '#ccc';
            // --- Scale Font Size & Position --- 
            context.font = `bold ${24 * dpi}px ${defaultFont}`; 
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2);
        }

        currentY_css += modeBtnHeight_css + sectionSpacing_css; // Move down (CSS pixels)

        // --- 4. Draw Player Controls (Improved Layout & Clarity) ---
        // --- Scale Font Size & Position --- 
        context.font = `bold ${26 * dpi}px ${defaultFont}`; 
        context.fillStyle = '#eee';
        context.textAlign = 'left'; // Align section title left
        const controlBoxWidth_css = 600; 
        const controlBoxStartX_css = scaledCenterX - controlBoxWidth_css / 2;
        const controlsTitleY_css = currentY_css;
        
        context.fillText('Player Controls', controlBoxStartX_css * dpi, controlsTitleY_css * dpi);
        
        // --- Define layout values in CSS pixels --- 
        const controlsStartY_css = controlsTitleY_css + 45; 
        const lineHeight_css = 50; 
        const playerColors = ['#ff4d4d', '#4dff4d', '#ff4dff', '#4dffff']; 
        const columnPadding_css = 15; 
        const keyBoxWidth_css = 90; 
        const keyBoxHeight_css = 32; 
        const keyBoxRadius_css = 8; 
        const keyTextOffsetX_css = 18; 
        const arrowSize_css = 5; 

        keyBindButtons = []; // Clear old buttons before repopulating

        for (let i = 1; i <= selectedPlayerCount; i++) {
            // --- Calculate base Y position in CSS pixels --- 
            const playerY_css = controlsStartY_css + (i - 1) * lineHeight_css; 
            const playerControl = currentControls[i];
            if (!playerControl) continue; // Skip if controls not found

            // --- Current X in CSS pixels --- 
            let currentX_css = controlBoxStartX_css;

            // Player Color Box
            context.fillStyle = playerColors[i - 1] || '#fff'; // Get color
            // --- Scale coords & dimensions --- 
            const colorBoxSize_css = 24;
            context.fillRect(currentX_css * dpi, (playerY_css - colorBoxSize_css / 2) * dpi, colorBoxSize_css * dpi, colorBoxSize_css * dpi); 
            currentX_css += colorBoxSize_css + columnPadding_css;

            // Player Name
            context.fillStyle = '#ccc';
            // --- Scale Font Size & Position --- 
            context.font = ` ${20 * dpi}px ${defaultFont}`; 
            context.textAlign = 'left';
            context.textBaseline = 'middle';
            const displayName = playerNames[i] || `Player ${i}`; 
            const nameMaxWidth_css = 180; 
            context.fillText(displayName, currentX_css * dpi, playerY_css * dpi, nameMaxWidth_css * dpi); // Scale max width too
            currentX_css += nameMaxWidth_css + columnPadding_css * 2; 

            // --- Left Key Area ---
            // --- Calculate scaled values --- 
            const leftKeyAreaX_css = currentX_css;
            const leftKeyAreaY_css = playerY_css - keyBoxHeight_css / 2;
            const isWaitingLeft = waitingForKeyBinding?.playerId === i && waitingForKeyBinding?.direction === 'left';
            
            const keyBoxX_scaled = leftKeyAreaX_css * dpi;
            const keyBoxY_scaled = leftKeyAreaY_css * dpi;
            const keyBoxWidth_scaled = keyBoxWidth_css * dpi;
            const keyBoxHeight_scaled = keyBoxHeight_css * dpi;
            const keyBoxRadius_scaled = keyBoxRadius_css * dpi;

            // Draw Background Box
            const btnGradientLeft = context.createLinearGradient(keyBoxX_scaled, keyBoxY_scaled, keyBoxX_scaled, keyBoxY_scaled + keyBoxHeight_scaled);
            if (isWaitingLeft) {
                btnGradientLeft.addColorStop(0, '#cc9900'); btnGradientLeft.addColorStop(1, '#aa7700'); 
            } else {
                btnGradientLeft.addColorStop(0, '#5a5a5a'); btnGradientLeft.addColorStop(1, '#444444');
            }
            context.fillStyle = btnGradientLeft;
            drawRoundedRect(context, keyBoxX_scaled, keyBoxY_scaled, keyBoxWidth_scaled, keyBoxHeight_scaled, keyBoxRadius_scaled);
            context.fill();

             // Draw Border (Subtle indication of clickability)
            context.strokeStyle = '#888';
             // --- Scale Line Width & coords --- 
            context.lineWidth = 1 * dpi;
            drawRoundedRect(context, keyBoxX_scaled + 0.5 * dpi, keyBoxY_scaled + 0.5 * dpi, keyBoxWidth_scaled - 1 * dpi, keyBoxHeight_scaled - 1 * dpi, keyBoxRadius_scaled - 0.5 * dpi);
            context.stroke();


            // Draw Key Text or "..."
            context.fillStyle = 'white';
            // --- Scale Font Size & Position --- 
            context.font = `bold ${18 * dpi}px ${defaultFont}`; 
            context.textAlign = 'center'; 
            context.textBaseline = 'middle';
            const leftKeyText = isWaitingLeft ? '...' : playerControl.left.toUpperCase();
            context.fillText(leftKeyText, keyBoxX_scaled + keyBoxWidth_scaled / 2 + (isWaitingLeft ? 0 : keyTextOffsetX_css * dpi / 2), playerY_css * dpi); 

            // Draw Left Arrow Icon (if not waiting)
            if (!isWaitingLeft) {
                // --- Scale coords & size --- 
                const arrowX_scaled = (leftKeyAreaX_css + keyTextOffsetX_css) * dpi;
                const arrowY_scaled = playerY_css * dpi;
                const arrowSize_scaled = arrowSize_css * dpi;
                context.beginPath();
                context.moveTo(arrowX_scaled, arrowY_scaled);
                context.lineTo(arrowX_scaled - arrowSize_scaled, arrowY_scaled - arrowSize_scaled);
                context.moveTo(arrowX_scaled, arrowY_scaled);
                context.lineTo(arrowX_scaled - arrowSize_scaled, arrowY_scaled + arrowSize_scaled);
                context.strokeStyle = 'white';
                // --- Scale Line Width --- 
                context.lineWidth = 2 * dpi;
                context.stroke();
            }

             // --- Store SCALED button coordinates/dimensions --- 
            keyBindButtons.push({ x: keyBoxX_scaled, y: keyBoxY_scaled, width: keyBoxWidth_scaled, height: keyBoxHeight_scaled, playerId: i, direction: 'left' });
            currentX_css += keyBoxWidth_css + columnPadding_css;

             // --- Right Key Area ---
            // --- Calculate scaled values --- 
            const rightKeyAreaX_css = currentX_css;
            const rightKeyAreaY_css = playerY_css - keyBoxHeight_css / 2;
            const isWaitingRight = waitingForKeyBinding?.playerId === i && waitingForKeyBinding?.direction === 'right';

            const rightKeyBoxX_scaled = rightKeyAreaX_css * dpi;
            // rightKeyBoxY_scaled = keyBoxY_scaled
            // rightKeyBoxWidth_scaled = keyBoxWidth_scaled
            // rightKeyBoxHeight_scaled = keyBoxHeight_scaled
            // rightKeyBoxRadius_scaled = keyBoxRadius_scaled

            // Draw Background Box
            const btnGradientRight = context.createLinearGradient(rightKeyBoxX_scaled, keyBoxY_scaled, rightKeyBoxX_scaled, keyBoxY_scaled + keyBoxHeight_scaled);
             if (isWaitingRight) {
                btnGradientRight.addColorStop(0, '#cc9900'); btnGradientRight.addColorStop(1, '#aa7700'); 
            } else {
                btnGradientRight.addColorStop(0, '#5a5a5a'); btnGradientRight.addColorStop(1, '#444444');
            }
            context.fillStyle = btnGradientRight;
            drawRoundedRect(context, rightKeyBoxX_scaled, keyBoxY_scaled, keyBoxWidth_scaled, keyBoxHeight_scaled, keyBoxRadius_scaled);
            context.fill();

             // Draw Border
            context.strokeStyle = '#888';
             // --- Scale Line Width & coords --- 
            context.lineWidth = 1 * dpi;
            drawRoundedRect(context, rightKeyBoxX_scaled + 0.5 * dpi, keyBoxY_scaled + 0.5 * dpi, keyBoxWidth_scaled - 1 * dpi, keyBoxHeight_scaled - 1 * dpi, keyBoxRadius_scaled - 0.5 * dpi);
            context.stroke();

            // Draw Key Text or "..."
            context.fillStyle = 'white';
             // --- Scale Font Size & Position --- 
            context.font = `bold ${18 * dpi}px ${defaultFont}`; 
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const rightKeyText = isWaitingRight ? '...' : playerControl.right.toUpperCase();
            context.fillText(rightKeyText, rightKeyBoxX_scaled + keyBoxWidth_scaled / 2 - (isWaitingRight ? 0 : keyTextOffsetX_css * dpi / 2), playerY_css * dpi); 

             // Draw Right Arrow Icon (if not waiting)
             if (!isWaitingRight) {
                 // --- Scale coords & size --- 
                const arrowX_scaled = (rightKeyAreaX_css + keyBoxWidth_css - keyTextOffsetX_css) * dpi;
                const arrowY_scaled = playerY_css * dpi;
                const arrowSize_scaled = arrowSize_css * dpi;
                context.beginPath();
                context.moveTo(arrowX_scaled, arrowY_scaled);
                context.lineTo(arrowX_scaled + arrowSize_scaled, arrowY_scaled - arrowSize_scaled);
                context.moveTo(arrowX_scaled, arrowY_scaled);
                context.lineTo(arrowX_scaled + arrowSize_scaled, arrowY_scaled + arrowSize_scaled);
                context.strokeStyle = 'white';
                // --- Scale Line Width --- 
                context.lineWidth = 2 * dpi;
                context.stroke();
            }

             // --- Store SCALED button coordinates/dimensions --- 
            keyBindButtons.push({ x: rightKeyBoxX_scaled, y: keyBoxY_scaled, width: keyBoxWidth_scaled, height: keyBoxHeight_scaled, playerId: i, direction: 'right' });

            // Reset context states if changed (optional, but good practice)
            context.textAlign = 'left'; // Reset default alignment
            context.textBaseline = 'alphabetic'; // Reset baseline
            context.lineWidth = 1 * dpi; // Reset line width
        }

        currentY_css += (selectedPlayerCount * lineHeight_css) + sectionSpacing_css / 2; // Update Y pos (CSS pixels)

        // --- 5. Prompt to start ---
        context.textAlign = 'center'; // Center prompt text
        context.textBaseline = 'middle';
        // --- Position in CSS pixels --- 
        const promptY_css = Math.max(currentY_css, displayHeight - 60); 

        if (selectedGameMode && !waitingForKeyBinding) { // Only show if not binding a key
            context.fillStyle = '#ccc'; // Brighter prompt
            // --- Scale Font Size & Position --- 
            context.font = ` ${22 * dpi}px ${defaultFont}`; 
            context.fillText('Press Space to Start', scaledCenterX * dpi, promptY_css * dpi); 
        } else if (waitingForKeyBinding) {
            context.fillStyle = '#ffdd88'; // Brighter yellow prompt for waiting
             // --- Scale Font Size & Position --- 
            context.font = ` ${20 * dpi}px ${defaultFont}`; 
            context.fillText(`Press a key for ${playerNames[waitingForKeyBinding.playerId] || `Player ${waitingForKeyBinding.playerId}`} ${waitingForKeyBinding.direction} turn... (Esc to cancel)`, scaledCenterX * dpi, promptY_css * dpi);
        } else if (!selectedGameMode) {
             context.fillStyle = '#aaa'; // Dimmed prompt if no mode selected
             // --- Scale Font Size & Position --- 
            context.font = ` ${20 * dpi}px ${defaultFont}`; 
            context.fillText('Select a Game Mode above', scaledCenterX * dpi, promptY_css * dpi);
        }

    } else if (gameState === 'Paused') {
        // 1. Draw the underlying game screen as it was
        // drawRunningGameScreen already handles scaling internally
        drawRunningGameScreen(context, currentPlayers);

        // 2. Draw the semi-transparent overlay
        context.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Make overlay slightly darker
        // Use client dimensions for overlay logic, scale drawing
        const displayWidth = canvas!.clientWidth;
        const displayHeight = canvas!.clientHeight;
        context.fillRect(0, 0, displayWidth * dpi, displayHeight * dpi); // Scale fill rect

        // 3. Draw "Paused" text and resume instruction (Use scaled center)
        const scaledCenterX_scaled = displayWidth / 2 * dpi;
        const scaledCenterY_scaled = displayHeight / 2 * dpi;

        context.fillStyle = 'white';
        // --- Scale Font Size --- 
        context.font = `bold ${60 * dpi}px ${defaultFont}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('Paused', scaledCenterX_scaled, scaledCenterY_scaled - 30 * dpi); // Scale offset

        // --- Scale Font Size & Position --- 
        context.font = ` ${24 * dpi}px ${defaultFont}`;
        context.fillText('Press Space to Resume', scaledCenterX_scaled, scaledCenterY_scaled + 30 * dpi); // Scale offset

    } else if (gameState === 'GameOver') {
        const winner = currentPlayers?.find(p => p.isAlive);
        // --- Define dimensions in CSS pixels --- 
        const boxWidth_css = 350; 
        const boxHeight_css = 180;
        // --- Use client dimensions for CSS centering --- 
        const displayWidth = canvas!.clientWidth; 
        const displayHeight = canvas!.clientHeight;
        const scaledCenterX_css = displayWidth / 2;
        const scaledCenterY_css = displayHeight / 2;
        const boxX_css = scaledCenterX_css - boxWidth_css / 2;
        const boxY_css = scaledCenterY_css - boxHeight_css / 2;

        // --- Calculate scaled values --- 
        const boxX_scaled = boxX_css * dpi;
        const boxY_scaled = boxY_css * dpi;
        const boxWidth_scaled = boxWidth_css * dpi;
        const boxHeight_scaled = boxHeight_css * dpi;
        const boxRadius_scaled = 20 * dpi;
        const scaledCenterX_scaled = scaledCenterX_css * dpi;
        const scaledCenterY_scaled = scaledCenterY_css * dpi;

        // Draw background square with gradient (consistent dark theme)
        const previousAlpha = context.globalAlpha;
        context.globalAlpha = 0.8; // Slightly more opaque popup
        const popupGradient = context.createLinearGradient(boxX_scaled, boxY_scaled, boxX_scaled, boxY_scaled + boxHeight_scaled);
        popupGradient.addColorStop(0, '#4a4a4a'); 
        popupGradient.addColorStop(1, '#2a2a2a'); 
        context.fillStyle = popupGradient;
        drawRoundedRect(context, boxX_scaled, boxY_scaled, boxWidth_scaled, boxHeight_scaled, boxRadius_scaled); 
        context.fill(); 
        context.globalAlpha = previousAlpha;

        // Draw border using winner color (or white for draw)
        context.strokeStyle = winner ? winner.color : '#ffffff';
        // --- Scale Line Width & coords --- 
        const borderWidth_scaled = 4 * dpi;
        context.lineWidth = borderWidth_scaled;
        drawRoundedRect(context, boxX_scaled + borderWidth_scaled / 2, boxY_scaled + borderWidth_scaled / 2, boxWidth_scaled - borderWidth_scaled, boxHeight_scaled - borderWidth_scaled, boxRadius_scaled - borderWidth_scaled / 2); 
        context.stroke();

        // Reset line width for text
        context.lineWidth = 1 * dpi;
        context.fillStyle = 'white'; // Ensure text is white

        context.textBaseline = 'middle';
        context.textAlign = 'center';

        // Draw Game Over text
         // --- Scale Font Size & Position --- 
        context.font = `bold ${44 * dpi}px ${defaultFont}`; 
        context.fillText('Konec Hry!', scaledCenterX_scaled, scaledCenterY_scaled - 50 * dpi); // Scale offset

        // Draw Play Again text
         // --- Scale Font Size & Position --- 
        context.font = ` ${22 * dpi}px ${defaultFont}`; 
        context.fillText('Press Enter to Play Again', scaledCenterX_scaled, scaledCenterY_scaled); 
        
        // Draw Winner text (or Draw)
         // --- Scale Font Size & Position --- 
        context.font = `bold ${30 * dpi}px ${defaultFont}`; 
        if (winner) {
            context.fillStyle = 'white'; 
            context.fillText(`${winner.name} Wins!`, scaledCenterX_scaled, scaledCenterY_scaled + 50 * dpi); // Scale offset
        } else if (currentPlayers && currentPlayers.length > 0) { 
             context.fillStyle = 'white';
             context.fillText('Draw!', scaledCenterX_scaled, scaledCenterY_scaled + 50 * dpi); // Scale offset
        }

        // Draw Play Again text (different prompt)
         // --- Scale Font Size & Position --- 
        context.font = ` ${20 * dpi}px ${defaultFont}`; 
        context.fillStyle = '#ddd';
        context.fillText('Press Enter for Main Menu', scaledCenterX_scaled, boxY_scaled + boxHeight_scaled - 25 * dpi); // Scale offset

    } else if (gameState === 'SessionOver') {
        // --- Session Over Screen (Game End) --- 
        const scores = currentPlayers ? Object.entries(lastScores).sort(([, scoreA], [, scoreB]) => scoreB - scoreA) : [];
        const winnerId = scores.length > 0 ? parseInt(scores[0]![0]) : null;
        const winner = currentPlayers?.find(p => p.id === winnerId);
        
        // --- Define dimensions in CSS pixels --- 
        const boxWidth_css = 400; 
        const boxHeight_css = 220; 
        // --- Use client dimensions for CSS centering --- 
        const displayWidth = canvas!.clientWidth;
        const displayHeight = canvas!.clientHeight;
        const scaledCenterX_css = displayWidth / 2;
        const scaledCenterY_css = displayHeight / 2;
        const boxX_css = scaledCenterX_css - boxWidth_css / 2;
        const boxY_css = scaledCenterY_css - boxHeight_css / 2;

        // --- Calculate scaled values --- 
        const boxX_scaled = boxX_css * dpi;
        const boxY_scaled = boxY_css * dpi;
        const boxWidth_scaled = boxWidth_css * dpi;
        const boxHeight_scaled = boxHeight_css * dpi;
        const boxRadius_scaled = 20 * dpi;
        const scaledCenterX_scaled = scaledCenterX_css * dpi;
        // const scaledCenterY_scaled = scaledCenterY_css * dpi; // Not needed below

        // Draw background square using gradient (consistent dark theme)
        const previousAlpha = context.globalAlpha;
        context.globalAlpha = 0.8;
        const popupGradient = context.createLinearGradient(boxX_scaled, boxY_scaled, boxX_scaled, boxY_scaled + boxHeight_scaled);
        popupGradient.addColorStop(0, '#4a4a4a'); 
        popupGradient.addColorStop(1, '#2a2a2a'); 
        context.fillStyle = popupGradient;
        drawRoundedRect(context, boxX_scaled, boxY_scaled, boxWidth_scaled, boxHeight_scaled, boxRadius_scaled);
        context.fill(); 
        context.globalAlpha = previousAlpha;

        // Draw border using winner color (or white if no winner somehow)
        context.strokeStyle = winner ? winner.color : '#ffffff';
        // --- Scale Line Width & coords --- 
        const borderWidth_scaled = 4 * dpi;
        context.lineWidth = borderWidth_scaled; 
        drawRoundedRect(context, boxX_scaled + borderWidth_scaled / 2, boxY_scaled + borderWidth_scaled / 2, boxWidth_scaled - borderWidth_scaled, boxHeight_scaled - borderWidth_scaled, boxRadius_scaled - borderWidth_scaled / 2); 
        context.stroke();

        // Reset line width for text
        context.lineWidth = 1 * dpi;
        context.fillStyle = 'white';

        context.textBaseline = 'middle';
        context.textAlign = 'center';

        // Draw Game Over text
         // --- Scale Font Size & Position --- 
        context.font = `bold ${48 * dpi}px ${defaultFont}`; 
        context.fillText('Game Over!', scaledCenterX_scaled, boxY_scaled + 40 * dpi); // Scale offset

        // Draw Winner text
         // --- Scale Font Size & Position --- 
        context.font = `bold ${32 * dpi}px ${defaultFont}`; 
        if (winner) {
            context.fillStyle = 'white'; 
            context.fillText(`${winner.name} Wins the Game!`, scaledCenterX_scaled, boxY_scaled + 85 * dpi); // Scale offset
        } else {
             context.fillStyle = 'white';
             context.fillText('Session Complete!', scaledCenterX_scaled, boxY_scaled + 85 * dpi); // Scale offset
        }

         // Draw Play Again text (different prompt)
         // --- Scale Font Size & Position --- 
        context.font = ` ${20 * dpi}px ${defaultFont}`; 
        context.fillStyle = '#ddd';
        context.fillText('Press Enter for Main Menu', scaledCenterX_scaled, boxY_scaled + boxHeight_scaled - 25 * dpi); // Scale offset
    }

    // Reset baseline and fillStyle after drawing state text
    context.textBaseline = 'alphabetic'; 
    context.fillStyle = 'black'; 
}

// --- Start Game ---
resizeCanvas(); // Initial sizing of the canvas
assignInitialPlayerNames(selectedPlayerCount); // Assign initial names based on loaded/default count
// Initial draw of the WaitingToStart screen
if (gameState === 'WaitingToStart' && ctx) {
    drawGameState(ctx, players);
}
console.log('Game ready. Initial state:', gameState);
console.log('Starting game loop...');
requestAnimationFrame((ts) => gameLoop(ts, ctx, players)); 
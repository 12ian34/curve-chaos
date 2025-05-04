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

// // Set canvas dimensions (Moved inside initializeGame)
// canvas.width = 800;
// canvas.height = 600;

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
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
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

    // Dimensions are now set by resizeCanvas
    const w = gameCanvas.width;
    const h = gameCanvas.height;
    const playerColors = ['red', 'lime', 'magenta', 'cyan']; // NEW Colors (P1: Red, P2: Green, P3: Pink, P4: Light Blue)

    // Calculate playable width considering leaderboard
    const leaderboardWidth = 250; // UPDATED WIDTH
    const padding = 15; // Needs to match drawLeaderboard
    const playableWidth = w - leaderboardWidth - (2 * padding);
    console.log(`Canvas Width: ${w}, Leaderboard: ${leaderboardWidth}, Padding: ${padding}, Playable Width: ${playableWidth}`);

    const newPlayers: Player[] = [];

    // --- Calculate Safe Zone --- (Using playableWidth)
    let minX = SAFE_ZONE_BUFFER;
    let maxX = playableWidth - SAFE_ZONE_BUFFER; // Use playableWidth
    let minY = SAFE_ZONE_BUFFER;
    let maxY = h - SAFE_ZONE_BUFFER;

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
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

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
    // Calculate playable width here as well
    const canvasWidth = context.canvas.width;
    const leaderboardWidth = 250; // UPDATED WIDTH
    const padding = 15; // Match drawLeaderboard
    const playableWidth = canvasWidth - leaderboardWidth - (2 * padding);
    const canvasHeight = context.canvas.height;
    const margin = POWERUP_RADIUS * 2; // Keep away from edges

    // TODO: Add check to prevent spawning on trails
    const spawnX = Math.random() * (playableWidth - margin * 2) + margin; // Use playableWidth
    const spawnY = Math.random() * (canvasHeight - margin * 2) + margin;

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
            const canvasWidth = ctx?.canvas.width ?? 800; // Need canvas dimensions
            const canvasHeight = ctx?.canvas.height ?? 600;
            const leaderboardWidth = 250; // Match leaderboard drawing
            const padding = 15; // Match leaderboard drawing
            const playableWidth = canvasWidth - leaderboardWidth - (2 * padding);
            
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

    // Calculate playable width for use in collision checks
    const canvasWidth = context.canvas.width;
    const leaderboardWidth = 250; // UPDATED WIDTH
    const padding = 15; // Match drawLeaderboard
    const playableWidth = canvasWidth - leaderboardWidth - (2 * padding);
    const canvasHeight = context.canvas.height;

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
                    playableWidth, // Pass playableWidth
                    canvasHeight, // Pass full height
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
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height; // Use height for potential vertical centering or padding
    const leaderboardWidth = 250; // UPDATED WIDTH
    const padding = 15;
    const leaderboardX = canvasWidth - leaderboardWidth - padding;
    const leaderboardY = padding;
    const leaderboardHeight = canvasHeight - 2 * padding; // Use available height
    const lineHeight = 30; // Increased line height for scores
    const titleFontSize = 24; // Increased title font size
    const scoreFontSize = 20; // Increased score font size
    const defaultFont = "'Poppins', sans-serif"; // Define font family

    // Draw semi-transparent background gradient
    const previousAlpha = ctx.globalAlpha;
    ctx.globalAlpha = 0.75; // Slightly more opaque
    const bgGradient = ctx.createLinearGradient(leaderboardX, leaderboardY, leaderboardX, leaderboardY + leaderboardHeight);
    bgGradient.addColorStop(0, '#3a3a3a'); // Darker grey top
    bgGradient.addColorStop(1, '#1a1a1a'); // Even darker bottom
    ctx.fillStyle = bgGradient;
    drawRoundedRect(ctx, leaderboardX, leaderboardY, leaderboardWidth, leaderboardHeight, 10);
    ctx.fill();

    // Add a subtle inner border/highlight
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; 
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, leaderboardX + 1, leaderboardY + 1, leaderboardWidth - 2, leaderboardHeight - 2, 9); // Inset border
    ctx.stroke();

    ctx.globalAlpha = previousAlpha; // Restore alpha before text

    // Draw Title
    ctx.fillStyle = '#ffffff'; // White title
    ctx.font = `bold ${titleFontSize}px ${defaultFont}`; // Use Poppins Bold
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top'; // Align text from the top
    const titleX = leaderboardX + leaderboardWidth / 2;
    const titleY = leaderboardY + padding;
    ctx.fillText('Scores', titleX, titleY);

    // Sort players by score (highest first)
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

    // Draw Scores
    ctx.font = `bold ${scoreFontSize}px ${defaultFont}`; // Use Poppins Bold for scores too
    ctx.textAlign = 'left';
    const scoreStartX = leaderboardX + padding + 10; // Indent scores slightly more
    let currentY = titleY + titleFontSize + padding * 1.5; // Start below title with more space

    for (let i = 0; i < sortedPlayers.length; i++) {
        const player = sortedPlayers[i];
        if (!player) continue; // Safety check
        if (currentY + scoreFontSize > leaderboardY + leaderboardHeight - padding) {
            break; // Stop if we run out of space
        }
        // Use player color
        ctx.fillStyle = player.color;
        const scoreText = `${player.name}: ${player.score}`; // Use name instead of P<id>
        ctx.fillText(scoreText, scoreStartX, currentY);

        // Clear shadow for next entry (No longer strictly necessary but harmless)
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        currentY += lineHeight;
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

// --- Button Layout Calculation ---
function calculateButtonLayout(canvasWidth: number, canvasHeight: number) {
    const btnWidth = 180; // Adjust size as needed
    const btnHeight = 60;
    const btnRadius = 15;
    // const btnY = canvasHeight / 2 + 50; // Old calculation - caused overlap
    // Calculate Y position below the controls list (approximate)
    const controlsBottomY = (canvasHeight / 2) + 100; // Based on 4 lines starting near centerY
    const btnY = controlsBottomY + 40; // Position buttons below controls + padding
    const spacing = 50;
    const totalWidth = btnWidth * 2 + spacing;
    const startX = (canvasWidth - totalWidth) / 2;
    
    modeButtons = [
        { x: startX, y: btnY, width: btnWidth, height: btnHeight, text: 'Classic', mode: 'Classic' as GameMode, radius: btnRadius },
        { x: startX + btnWidth + spacing, y: btnY, width: btnWidth, height: btnHeight, text: 'Arcade', mode: 'Arcade' as GameMode, radius: btnRadius },
    ];
}

// --- Helper to draw the current game screen (used by Running and Paused states) ---
function drawRunningGameScreen(context: CanvasRenderingContext2D, currentPlayers: Player[] | null) {
    // Calculate playable width
    const canvasWidth = context.canvas.width;
    const leaderboardWidth = 250; 
    const padding = 15; 
    const playableWidth = canvasWidth - leaderboardWidth - (2 * padding);
    const canvasHeight = context.canvas.height;

    // Draw Background Gradient
    const gradient = context.createLinearGradient(0, 0, 0, canvasHeight);
    gradient.addColorStop(0, '#1a0a2a'); 
    gradient.addColorStop(1, '#0a0a0a'); 
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw Playable Area Border
    context.strokeStyle = 'rgba(200, 200, 200, 0.5)'; 
    context.lineWidth = 2;
    context.strokeRect(1, 1, playableWidth - 2, canvasHeight - 2); 

    // Draw Trails
    if (currentPlayers) {
        for (const player of currentPlayers) {
            drawTrail(context, player);
        }
    }

    // Draw Powerups (always draw if they exist, even if paused)
    // This ensures they don't disappear when pausing
    for (const powerup of activePowerups) {
        drawPowerup(context, powerup);
    }

    // Draw Player Heads
    if (currentPlayers) {
        for (const player of currentPlayers) {
            if (player.isAlive) { 
                drawPlayer(context, player);
            }
        }
    }
    // Draw Leaderboard (always draw)
    drawLeaderboard(context, players);
}

// --- Draw Game State Function ---
function drawGameState(context: CanvasRenderingContext2D, currentPlayers: Player[] | null) {
    const canvasWidth = context.canvas.width;
    const canvasHeight = context.canvas.height;
    const currentControls = getPlayerControls(); // Get current controls
    const defaultFont = "'Poppins', sans-serif"; // Define font family

    // This function now PRIMARILY handles drawing OVERLAYS or specific state screens,
    // NOT the main running game screen (that's drawRunningGameScreen).

    // Reset button arrays for recalculation (only for WaitingToStart)
    if (gameState === 'WaitingToStart') {
        modeButtons = [];
        keyBindButtons = []; 
        playerCountButtons = []; // Reset player count buttons too
        // Calculate buttons specific to WaitingToStart
        if (canvasWidth > 0) {
            calculateButtonLayout(canvasWidth, canvasHeight);
        }
    }

    context.textAlign = 'center';
    context.textBaseline = 'middle'; 
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Clear canvas before drawing states (except for Running/Paused which draw their own background)
    if (gameState !== 'Running' && gameState !== 'Paused') {
        context.clearRect(0, 0, canvasWidth, canvasHeight);
        // Optionally draw the default background for non-running states?
        const bgGradient = context.createLinearGradient(0, 0, 0, canvasHeight);
        bgGradient.addColorStop(0, '#1a0a2a');
        bgGradient.addColorStop(1, '#0a0a0a');
        context.fillStyle = bgGradient;
        context.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    if (gameState === 'WaitingToStart') {
        context.fillStyle = '#eee'; // Brighter text
        context.font = `bold 48px ${defaultFont}`; // Use Poppins Bold
        context.fillText('Select Game Mode', centerX, centerY - 180); // Move title up

        // --- Draw Player Count Selection --- 
        const playerCountY = centerY - 120; // Position above mode buttons
        const pcBtnWidth = 40;
        const pcBtnHeight = 30;
        const pcTextWidth = 150;
        const pcSpacing = 10;
        const pcTotalWidth = pcBtnWidth * 2 + pcTextWidth + pcSpacing * 2;
        const pcStartX = centerX - pcTotalWidth / 2;

        // Decrease Button
        const btnGradientMinus = context.createLinearGradient(pcStartX, playerCountY - pcBtnHeight / 2, pcStartX, playerCountY + pcBtnHeight / 2);
        btnGradientMinus.addColorStop(0, '#666'); // Lighter top
        btnGradientMinus.addColorStop(1, '#444'); // Darker bottom
        context.fillStyle = btnGradientMinus;
        drawRoundedRect(context, pcStartX, playerCountY - pcBtnHeight / 2, pcBtnWidth, pcBtnHeight, 5);
        context.fill();
        context.fillStyle = 'white';
        context.font = `bold 24px ${defaultFont}`; // Use Poppins Bold
        context.textAlign = 'center';
        context.fillText('-', pcStartX + pcBtnWidth / 2, playerCountY);
        playerCountButtons.push({ x: pcStartX, y: playerCountY - pcBtnHeight / 2, width: pcBtnWidth, height: pcBtnHeight, action: 'decrease', text: '-' });
        
        // Player Count Text
        context.fillStyle = '#ddd';
        context.font = `20px ${defaultFont}`; // Use Poppins Regular
        context.fillText(`Players: ${selectedPlayerCount}`, pcStartX + pcBtnWidth + pcSpacing + pcTextWidth / 2, playerCountY);
        
        // Increase Button
        const increaseBtnX = pcStartX + pcBtnWidth + pcSpacing + pcTextWidth + pcSpacing;
        const btnGradientPlus = context.createLinearGradient(increaseBtnX, playerCountY - pcBtnHeight / 2, increaseBtnX, playerCountY + pcBtnHeight / 2);
        btnGradientPlus.addColorStop(0, '#666'); // Lighter top
        btnGradientPlus.addColorStop(1, '#444'); // Darker bottom
        context.fillStyle = btnGradientPlus;
        drawRoundedRect(context, increaseBtnX, playerCountY - pcBtnHeight / 2, pcBtnWidth, pcBtnHeight, 5);
        context.fill();
        context.fillStyle = 'white';
        context.font = `bold 24px ${defaultFont}`; // Use Poppins Bold
        context.fillText('+', increaseBtnX + pcBtnWidth / 2, playerCountY);
        playerCountButtons.push({ x: increaseBtnX, y: playerCountY - pcBtnHeight / 2, width: pcBtnWidth, height: pcBtnHeight, action: 'increase', text: '+' });

        // Draw mode buttons (uses calculated layout from calculateButtonLayout)
        for (const button of modeButtons) {
            const isSelected = selectedGameMode === button.mode;
            // Background Gradient
            const btnGradient = context.createLinearGradient(button.x, button.y, button.x, button.y + button.height);
            if (isSelected) {
                btnGradient.addColorStop(0, '#009900'); // Lighter green
                btnGradient.addColorStop(1, '#005500'); // Darker green
            } else {
                btnGradient.addColorStop(0, '#555'); // Lighter grey
                btnGradient.addColorStop(1, '#333'); // Darker grey
            }
            context.fillStyle = btnGradient;
            drawRoundedRect(context, button.x, button.y, button.width, button.height, button.radius);
            context.fill();

            // Border
            context.strokeStyle = isSelected ? '#00cc00' : '#777'; // Adjusted default grey border
            context.lineWidth = 2;
            drawRoundedRect(context, button.x, button.y, button.width, button.height, button.radius);
            context.stroke();

            // Text
            context.fillStyle = isSelected ? 'white' : '#ccc';
            context.font = `bold 24px ${defaultFont}`; // Use Poppins Bold for mode buttons
            context.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2);
        }

        // --- Draw Player Controls --- 
        context.font = `bold 24px ${defaultFont}`; // Use Poppins Bold for section title
        context.fillStyle = '#ddd';
        context.textAlign = 'left'; // Align text left for controls
        const controlsStartY = centerY - 40; // Starting Y position for controls list
        const lineHeight = 35;
        const playerColors = ['red', 'lime', 'magenta', 'cyan']; // Assuming IDs 1-4
        const controlBoxWidth = 500; // Width of the controls area
        const controlBoxStartX = centerX - controlBoxWidth / 2;

        context.fillText('Player Controls:', controlBoxStartX, controlsStartY - lineHeight);

        // Only loop up to selectedPlayerCount
        for (let i = 1; i <= selectedPlayerCount; i++) {
            const playerY = controlsStartY + (i - 1) * lineHeight;
            const playerControl = currentControls[i];
            if (!playerControl) continue; // Skip if controls not found

            // Player ID and Color Box
            context.fillStyle = playerColors[i - 1] || '#fff'; // Get color (Using the same playerColors array)
            context.fillRect(controlBoxStartX, playerY - 10, 20, 20); // Draw color box
            context.fillStyle = '#ccc';
            context.font = `18px ${defaultFont}`; // Use Poppins Regular
            const displayName = playerNames[i] || `P${i}`; // Get assigned name or fallback
            context.fillText(displayName, controlBoxStartX + 30, playerY); 

            const keyDisplayX = controlBoxStartX + 70;
            const changeBtnWidth = 60;
            const changeBtnHeight = 24;
            const keyBtnSpacing = 5;

            // Left Control
            context.fillText('Left:', keyDisplayX, playerY);
            const leftKeyText = playerControl.left;
            context.fillStyle = '#fff';
            context.font = `bold 18px ${defaultFont}`; // Poppins Bold for keys
            context.fillText(leftKeyText, keyDisplayX + 45, playerY);
            const leftBtnX = keyDisplayX + 45 + context.measureText(leftKeyText).width + keyBtnSpacing;
            
            // Draw Left Change Button
            const isWaitingLeft = waitingForKeyBinding?.playerId === i && waitingForKeyBinding?.direction === 'left';
            const btnGradientLeft = context.createLinearGradient(leftBtnX, playerY - changeBtnHeight / 2, leftBtnX, playerY + changeBtnHeight / 2);
            if (isWaitingLeft) {
                btnGradientLeft.addColorStop(0, '#ffa500'); // Lighter orange
                btnGradientLeft.addColorStop(1, '#cc7a00'); // Darker orange
            } else {
                btnGradientLeft.addColorStop(0, '#555'); // Lighter grey
                btnGradientLeft.addColorStop(1, '#333'); // Darker grey
            }
            context.fillStyle = btnGradientLeft;
            drawRoundedRect(context, leftBtnX, playerY - changeBtnHeight / 2, changeBtnWidth, changeBtnHeight, 5);
            context.fill();
            context.fillStyle = 'white';
            context.font = `14px ${defaultFont}`; // Poppins Regular for button text
            context.textAlign = 'center'; // Center button text
            context.fillText(isWaitingLeft ? 'Press...' : 'Change', leftBtnX + changeBtnWidth / 2, playerY);
            keyBindButtons.push({ x: leftBtnX, y: playerY - changeBtnHeight / 2, width: changeBtnWidth, height: changeBtnHeight, playerId: i, direction: 'left'});
            context.textAlign = 'left'; // Reset alignment
            context.font = `18px ${defaultFont}`; // Poppins Regular for labels
            context.fillStyle = '#ccc';

            // Right Control
            const rightKeyX = leftBtnX + changeBtnWidth + 20; // Position right controls relative to left
            context.fillText('Right:', rightKeyX, playerY);
            const rightKeyText = playerControl.right;
            context.fillStyle = '#fff';
            context.font = `bold 18px ${defaultFont}`; // Poppins Bold for keys
            context.fillText(rightKeyText, rightKeyX + 50, playerY);
            const rightBtnX = rightKeyX + 50 + context.measureText(rightKeyText).width + keyBtnSpacing;

            // Draw Right Change Button
            const isWaitingRight = waitingForKeyBinding?.playerId === i && waitingForKeyBinding?.direction === 'right';
            const btnGradientRight = context.createLinearGradient(rightBtnX, playerY - changeBtnHeight / 2, rightBtnX, playerY + changeBtnHeight / 2);
            if (isWaitingRight) {
                btnGradientRight.addColorStop(0, '#ffa500'); // Lighter orange
                btnGradientRight.addColorStop(1, '#cc7a00'); // Darker orange
            } else {
                btnGradientRight.addColorStop(0, '#555'); // Lighter grey
                btnGradientRight.addColorStop(1, '#333'); // Darker grey
            }
            context.fillStyle = btnGradientRight;
            drawRoundedRect(context, rightBtnX, playerY - changeBtnHeight / 2, changeBtnWidth, changeBtnHeight, 5);
            context.fill();
            context.fillStyle = 'white';
            context.font = `14px ${defaultFont}`; // Poppins Regular for button text
            context.textAlign = 'center'; // Center button text
            context.fillText(isWaitingRight ? 'Press...' : 'Change', rightBtnX + changeBtnWidth / 2, playerY);
            keyBindButtons.push({ x: rightBtnX, y: playerY - changeBtnHeight / 2, width: changeBtnWidth, height: changeBtnHeight, playerId: i, direction: 'right'});
            context.textAlign = 'left'; // Reset alignment
            context.font = `18px ${defaultFont}`; // Poppins Regular for labels
            context.fillStyle = '#ccc';
        }
        context.textAlign = 'center'; // Reset alignment

        // Prompt to start if mode is selected
        if (selectedGameMode && !waitingForKeyBinding) { // Only show if not binding a key
            context.fillStyle = '#bbb';
            context.font = `20px ${defaultFont}`; // Poppins Regular
            context.fillText('Press Space to Start', centerX, canvasHeight - 60); // Changed from Enter to Space
        } else if (waitingForKeyBinding) {
            context.fillStyle = '#ffcc00'; // Yellow prompt for waiting
            context.font = `20px ${defaultFont}`; // Poppins Regular
            context.fillText(`Press a key for Player ${waitingForKeyBinding.playerId} ${waitingForKeyBinding.direction}... (Esc to cancel)`, centerX, canvasHeight - 60);
        }
    } else if (gameState === 'Paused') {
        // 1. Draw the underlying game screen as it was
        drawRunningGameScreen(context, currentPlayers);

        // 2. Draw the semi-transparent overlay
        context.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Darker overlay
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        // 3. Draw "Paused" text and resume instruction
        context.fillStyle = 'white';
        context.font = `bold 60px ${defaultFont}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('Paused', centerX, centerY - 30);

        context.font = `24px ${defaultFont}`;
        context.fillText('Press Space to Resume', centerX, centerY + 30);

    } else if (gameState === 'GameOver') {
        const winner = currentPlayers?.find(p => p.isAlive);
        const boxWidth = 350; // Larger box
        const boxHeight = 180;
        const boxX = centerX - boxWidth / 2;
        const boxY = centerY - boxHeight / 2;

        // Draw background square with gradient (consistent dark theme)
        const previousAlpha = context.globalAlpha;
        context.globalAlpha = 0.8; // Slightly more opaque popup
        const popupGradient = context.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
        popupGradient.addColorStop(0, '#4a4a4a'); // Lighter dark grey top
        popupGradient.addColorStop(1, '#2a2a2a'); // Darker grey bottom
        context.fillStyle = popupGradient;
        drawRoundedRect(context, boxX, boxY, boxWidth, boxHeight, 20); 
        context.fill(); 
        context.globalAlpha = previousAlpha;

        // Draw border using winner color (or white for draw)
        context.strokeStyle = winner ? winner.color : '#ffffff';
        context.lineWidth = 4; // Thicker border
        drawRoundedRect(context, boxX + context.lineWidth / 2, boxY + context.lineWidth / 2, boxWidth - context.lineWidth, boxHeight - context.lineWidth, 18); // Inset slightly
        context.stroke();

        // Reset line width for text
        context.lineWidth = 1;
        context.fillStyle = 'white'; // Ensure text is white

        context.textBaseline = 'middle';

        // Draw Game Over text
        context.font = `bold 44px ${defaultFont}`; // Poppins Bold
        context.fillText('Konec Hry!', centerX, centerY - 50); // Adjust

        // Draw Play Again text
        context.font = `22px ${defaultFont}`; // Poppins Regular
        context.fillText('Press Enter to Play Again', centerX, centerY); // Kept as Enter
        
        // Draw Winner text (or Draw)
        context.font = `bold 30px ${defaultFont}`; // Poppins Bold
        if (winner) {
            context.fillStyle = 'white'; 
            context.fillText(`${winner.name} Wins!`, centerX, centerY + 50); // Use winner.name
        } else if (currentPlayers && currentPlayers.length > 0) { // Check if players exist for draw case
             context.fillStyle = 'white';
             context.fillText('Draw!', centerX, centerY + 50); // Draw message
        }

        // Draw Play Again text (different prompt)
        context.font = `20px ${defaultFont}`; // Poppins Regular
        context.fillStyle = '#ddd';
        context.fillText('Press Enter for Main Menu', centerX, boxY + boxHeight - 25); // Kept as Enter
    } else if (gameState === 'SessionOver') {
        // --- Session Over Screen (Game End) --- 
        const scores = currentPlayers ? Object.entries(lastScores).sort(([, scoreA], [, scoreB]) => scoreB - scoreA) : [];
        const winnerId = scores.length > 0 ? parseInt(scores[0]![0]) : null;
        const winner = currentPlayers?.find(p => p.id === winnerId);
        
        const boxWidth = 400; // Slightly larger box
        const boxHeight = 220; // Taller box for scores
        const boxX = centerX - boxWidth / 2;
        const boxY = centerY - boxHeight / 2;

        // Draw background square using gradient (consistent dark theme)
        const previousAlpha = context.globalAlpha;
        context.globalAlpha = 0.8;
        const popupGradient = context.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
        popupGradient.addColorStop(0, '#4a4a4a'); // Lighter dark grey top
        popupGradient.addColorStop(1, '#2a2a2a'); // Darker grey bottom
        context.fillStyle = popupGradient;
        drawRoundedRect(context, boxX, boxY, boxWidth, boxHeight, 20);
        context.fill(); 
        context.globalAlpha = previousAlpha;

        // Draw border using winner color (or white if no winner somehow)
        context.strokeStyle = winner ? winner.color : '#ffffff';
        context.lineWidth = 4; // Thicker border
        drawRoundedRect(context, boxX + context.lineWidth / 2, boxY + context.lineWidth / 2, boxWidth - context.lineWidth, boxHeight - context.lineWidth, 18); // Inset slightly
        context.stroke();

        // Reset line width for text
        context.lineWidth = 1;
        context.fillStyle = 'white';

        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Draw Game Over text
        context.font = `bold 48px ${defaultFont}`; // Poppins Bold
        context.fillText('Game Over!', centerX, boxY + 40); // Position title

        // Draw Winner text
        context.font = `bold 32px ${defaultFont}`; // Poppins Bold
        if (winner) {
            context.fillStyle = 'white'; 
            context.fillText(`${winner.name} Wins the Game!`, centerX, boxY + 85); // Use winner.name
        } else {
            // Should ideally not happen if SessionOver is reached, but handle anyway
             context.fillStyle = 'white';
             context.fillText('Session Complete!', centerX, boxY + 85);
        }

         // Draw Play Again text (different prompt)
        context.font = `20px ${defaultFont}`; // Poppins Regular
        context.fillStyle = '#ddd';
        context.fillText('Press Enter for Main Menu', centerX, boxY + boxHeight - 25); 
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
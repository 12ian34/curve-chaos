# curve chaos

## Background and Motivation

The goal is to create a local multiplayer version of the classic game "Achtung, die Kurve!". Players control snakes that constantly move forward and leave a trail. The objective is to survive longer than other players by avoiding collisions with trails and boundaries. The game will feature two modes: "Classic" (standard rules) and "Arcade" (including powerups).

This version will be built using HTML, TypeScript, and the HTML Canvas API for rendering, running directly in the browser. This stack was chosen for its simplicity and suitability for a 2D browser game without requiring a complex web framework.

**Update:** The current request is to expand the game to support up to 4 players simultaneously and allow players to configure their left/right turn buttons instead of using hardcoded keys.

**Update 2:** Further requirements include allowing the user to select the number of players (1-4) before starting a game and implementing a scoring system to track wins across multiple rounds.

**Update 3:** A specific overall game win condition has been requested: the first player to reach at least 30 points AND be at least 2 points ahead of the second-highest score wins the entire game session.

**Update 4:** A new gameplay mechanic is requested: occasionally, a player's trail will form temporary gaps ("holes"). Other players can pass through these holes. Additionally, if a player collides with another trail *while* their own trail is in the process of forming a hole, they gain temporary invincibility and do not die from that collision.

**Update 5:** The starting position (x, y coordinates and initial angle) for all active players should be fully randomized at the start of each round. However, the (x, y) coordinates must not be within a margin of `2 * TURN_RADIUS` from any canvas edge.

**Update 6:** Improve the overall visual appeal of the game for a general audience. This includes potential enhancements to colors, background, typography, UI styling, and minor visual effects.

## Key Challenges and Analysis

- **Real-time Rendering:** Smoothly drawing multiple players and their growing trails on the canvas.
- **Collision Detection:** Efficiently detecting collisions between players' heads and trails, as well as canvas boundaries.
- **Input Handling:** Capturing keyboard inputs for multiple players simultaneously. (Update: Managing inputs for 4 players and handling configurable controls adds complexity).
- **Game State Management:** Tracking player positions, scores, game status (running, paused, game over), and current game mode. **(Update:** Requires managing round scores and overall game sessions). **(Update 2:** Need to add a final `SessionOver` state and handle transitions based on the new win condition).
- **TypeScript Setup:** Integrating TypeScript with a simple HTML/Canvas project requires a build step or module handling.
- **Powerup System (Arcade Mode):** Designing and implementing various powerups, their effects, spawning, and collection.
- **UI/Layout Adjustments:** The UI needs to accommodate displaying information (like scores or status) for 4 players without cluttering the screen. Starting positions might need adjustment. **(Update:** UI needed for player count selection and score display).
- **Control Configuration:** Designing a simple UI for players to select their preferred keys and ensuring the game logic uses these configured keys. Persisting these settings could be a future enhancement.
- **Player Count Selection:** Implementing UI for selecting player count and dynamically adjusting game setup (player creation, control display) based on the selection.
- **Scoring Logic:** Defining how scores are awarded (per round winner), storing scores, and resetting them appropriately (e.g., when starting a new game vs. starting a new round). **(Update:** Needs logic to check the complex win condition (>=30 and win by 2) after each round). **(Update 2:** The current scoring logic needs to be replaced. Instead of +1 for the winner, points will be awarded based on survival rank: 1st=3pts, 2nd=2pts, 3rd=1pt, 4th+=0pts. This requires tracking the order of elimination).
- **Tracking Elimination Order:** Need a reliable way to determine the order in which players are eliminated during a round to award ranked points correctly.
- **Trail Hole Logic:**
    - **Randomness/Trigger:** Determining *when* and for *how long* a hole should form. Should it be purely random chance per segment, or triggered periodically?
    - **Visual Representation:** How to visually indicate a hole is forming or active? Should the trail segment just not be drawn, or should there be a different visual style?
    - **Collision Modification:** Temporarily disabling collision detection for specific trail segments (the holes).
    - **Invincibility State:** Tracking when a player is *currently* forming a hole to grant temporary invincibility against collisions with *other* trails. This state needs a clear start and end.
    - **Performance:** Ensuring the checks for hole creation and invincibility don't significantly impact game performance, especially with multiple players.
- **Random Starting Positions:**
    - **Safe Zone Calculation:** Correctly calculating the valid spawning area based on canvas dimensions and `2 * TURN_RADIUS`.
    - **Random Value Generation:** Generating random `x`, `y`, and `angle` within the calculated safe zone and 0-360 degrees respectively for each player.
    - **Integration:** Modifying the player initialization logic (`initializeGame` in `main.ts`) to use these random values instead of predefined starting points.
    - **Overlap Avoidance (Potential Future):** Deciding if randomly placed players overlapping at the start is acceptable or if a minimum distance check is needed. (Not implementing overlap avoidance now).
- **Visual Appeal Enhancement:**
    - **Subjectivity:** "Appealing" is subjective; focus on common principles (better colors, fonts, polish).
    - **Performance:** Canvas visual effects (shadows, gradients, many particles) can impact performance; need to test.
    - **Font Loading:** Using web fonts requires proper CSS integration and handling potential loading delays (FOUT/FOIT).
    - **Consistency:** Apply chosen styles (colors, fonts) consistently across all UI elements.
- **Pause Implementation:**
    - **State Management:** Integrating a `Paused` state without disrupting existing state transitions (`WaitingToStart`, `Running`, `GameOver`, `SessionOver`).
    - **Input Handling:** Capturing the pause key press reliably only during the `Running` state and toggling between `Running` and `Paused`. Ignoring other game inputs while paused.
    - **Game Loop Suspension:** Effectively halting game logic updates (movement, collision, timers) while paused, but continuing rendering (including the pause overlay).
    - **Timer Handling:** Accurately pausing and resuming timers (powerup effects, hole generation) to account for the paused duration.
- **Persistent Settings:**
    - **Storage Mechanism:** Using `localStorage` is standard, but need to handle potential exceptions (e.g., storage disabled, quota exceeded).
    - **Data Structure:** Defining a clear structure to save player count and control configurations.
    - **Loading/Saving:** Implementing logic to load settings on startup and save changes when they occur (e.g., after changing controls or player count).
- **More Powerups:**
    - **Design & Balance:** Defining clear effects for new powerups (Ghost Mode, Thick Trail, Clear Own Trail, Random Teleport) and ensuring they are balanced.
    - **Implementation:** Adding new types to `PowerupType`, implementing their effects (potentially modifying `Player` state, collision logic, or `main.ts`), adding visuals, and integrating with spawning/collection.

## High-level Task Breakdown

1.  **Setup Basic HTML and Canvas:**
    *   Create an `index.html` file.
    *   Add a `<canvas>` element.
    *   Create a basic `style.css` for layout.
    *   Create a `src/` directory for TypeScript code.
    *   Setup TypeScript configuration (`tsconfig.json`).
    *   Setup a simple build process (e.g., using `tsc` or a bundler like `esbuild` or `vite`) to compile TypeScript to JavaScript.
    *   **Success Criteria:** A blank canvas is rendered in the browser when opening `index.html` (potentially after a build step). The TypeScript setup compiles without errors.

2.  **Implement Player Movement (Single Player):**
    *   Create a `Player` class/interface in TypeScript.
    *   Implement logic for a single player snake moving continuously forward.
    *   Handle keyboard input (e.g., left/right arrow keys) to change the player's direction.
    *   Draw the player's current position (head) on the canvas in each frame.
    *   **Success Criteria:** A single dot or small shape representing the player moves continuously on the canvas and changes direction based on key presses.

3.  **Implement Trail Drawing:**
    *   Modify the `Player` logic to store its path/trail segments.
    *   Draw the player's trail on the canvas in each frame.
    *   **Success Criteria:** The moving player leaves a continuous line behind it on the canvas.

4.  **Implement Collision Detection:**
    *   Detect collisions between a player's head and the canvas boundaries.
    *   Detect collisions between a player's head and any player's trail (including their own).
    *   Handle player elimination upon collision.
    *   **Success Criteria:** A player is marked as 'out' or removed when their head hits a boundary or a trail.

5.  **Implement Game Loop and State:**
    *   Create the main game loop (`requestAnimationFrame`).
    *   Manage game state (e.g., waiting to start, running, game over).
    *   Track scores or rounds won.
    *   Implement logic to determine the winner when only one player remains.
    *   Add basic UI elements for score display and game status.
    *   **Success Criteria:** The game starts, runs, detects collisions, eliminates players correctly, determines a winner, and displays basic game info.

6.  **Add Multiple Players and Controls (Initial 2 Player):**
    *   Modify the code to support multiple `Player` instances.
    *   Assign unique colors and starting positions to each player.
    *   Assign unique keyboard controls (e.g., P1: Left/Right Arrows, P2: A/D) to each player.
    *   **Success Criteria:** Multiple players can join the game, each controllable with different keys, and all move/draw trails simultaneously.

7.  **Implement Game Modes (Classic/Arcade):**
    *   Add logic to select or differentiate between Classic and Arcade modes.
    *   Ensure Classic mode runs with the standard rules established so far.
    *   **Success Criteria:** The game can be configured or started in either Classic or Arcade mode (even if Arcade has no powerups yet).

8.  **Implement Powerup System (Arcade Mode):** (Refined Breakdown)
    *   **8a. Review & Finalize Powerup Types:** Decide on the initial set of powerups and their specific effects (e.g., Speed Boost: +50% speed for 5s; Slow Others: -30% speed for other players for 5s; Invincibility: Ignore collisions for 3s; Thin Trail: Trail width = 1 for 10s; Reverse Controls: Swap left/right for affected players for 5s). Update `src/powerup.ts` with finalized types if needed.
        *   **Success Criteria:** `PowerupType` enum/type in `src/powerup.ts` is defined with the chosen initial powerups. Constants for durations/magnitudes are defined.
    *   **8b. Implement Powerup Spawning & Despawning:** Review/refine existing spawning logic in `main.ts`. Ensure powerups only spawn in Arcade mode. Add logic for powerups to despawn after a certain lifetime if not collected.
        *   **Success Criteria:** Powerups appear visually on the canvas only in Arcade mode at reasonable intervals. Powerups disappear after a set time (e.g., 10 seconds) if not collected. Spawning avoids overlapping existing trails (best effort).
    *   **8c. Implement Player-Powerup Collision:** Add logic (likely in `main.ts` game loop) to detect collision between player heads and active powerups. Remove the powerup upon collision.
        *   **Success Criteria:** When a player moves over a powerup, the powerup disappears, and a console log indicates collection.
    *   **8d. Implement Powerup Effects (Instantaneous):** Implement effects for powerups that happen instantly upon collection (e.g., if we add a hypothetical "Clear Trails" powerup later). (Currently none of the proposed examples are instantaneous).
        *   **Success Criteria:** N/A for currently proposed powerups.
    *   **8e. Implement Powerup Effects (Timed - Player State):** Modify `Player` state (`src/player.ts`) and update logic (`updatePlayer`) to handle timed effects like Speed Boost, Invincibility, Thin Trail, Reverse Controls. Add timers to track remaining duration.
        *   **Success Criteria:** Collecting Speed Boost increases player speed temporarily. Collecting Invincibility prevents collision deaths temporarily. Collecting Thin Trail reduces trail width temporarily. Collecting Reverse Controls swaps player input temporarily. Effects wear off after their duration.
    *   **8f. Implement Powerup Effects (Timed - Global/Other Players):** Modify logic (likely in `main.ts` or potentially affecting all `Player` objects) to handle effects impacting other players, like Slow Others.
        *   **Success Criteria:** Collecting Slow Others reduces the speed of all *other* active players temporarily.
    *   **8g. Visual Feedback for Powerups:** Ensure powerups are visually distinct on the canvas (`drawPowerup` in `src/powerup.ts`). Add visual indicators for active player powerup effects (e.g., change player color slightly, draw an icon near the player).
        *   **Success Criteria:** Powerups have clear visuals. Players visually indicate when effects like speed boost, invincibility, or reversed controls are active.

**--- Tasks for 4-Player and Configurable Controls ---**

9.  **Increase Player Count to 4 (Default):**
    *   Modify `player.ts` and `main.ts` to handle up to 4 players.
    *   Define distinct default colors (e.g., Blue, Red, Green, Yellow) and starting positions/angles for players 3 and 4. Ensure starting positions are reasonably spaced.
    *   Assign default hardcoded keyboard controls for players 3 and 4 (e.g., P3: Left/Right, P4: Numpad 4/6 or others).
    *   Update UI elements (like Game Over screen winner display) if necessary to correctly reference player IDs 1-4.
    *   **Success Criteria:** The game initializes with 4 players. All 4 players move, draw trails, and collide correctly based on their default assigned keys. The Game Over screen correctly identifies the winner (or draw) among 4 players.

10. **Refactor Input Handling for Configurable Controls:**
    *   Define a data structure (e.g., an array or map) to store control configurations for each player (e.g., `[{ left: 'ArrowLeft', right: 'ArrowRight' }, { left: 'a', right: 'd' }, ...]`). Store this in `main.ts` initially.
    *   Modify the `updatePlayer` function (and potentially related functions/types in `player.ts`) to accept the player's specific control keys as parameters instead of using hardcoded checks.
    *   Modify the input handling logic in `main.ts` (`handleKeyDown`, `handleKeyUp`, `gameLoop`) to use the control configuration map to determine which player should turn based on the `keyStates`.
    *   **Success Criteria:** Player controls are now driven by the configuration data structure. Changing the keys in this structure changes the controls used in the game, without modifying the core `updatePlayer` turning logic itself. The 4 players still work with their default assigned keys via this new structure.

11. **Implement Basic Control Selection UI:**
    *   Add UI elements (e.g., buttons or input fields) in the "WaitingToStart" state to allow players to select their keys.
    *   Implement logic to capture key presses for configuration.
    *   Update the control configuration data structure based on user input.
    *   **Success Criteria:** Users can interact with UI elements to change the keys assigned to each player's left/right turns. The UI layout is correct.

**--- Tasks for Player Count and Scoring ---**

12. **Implement Player Count Selection:**
    *   Add UI elements (e.g., +/- buttons, text display) to the "WaitingToStart" screen to select the number of players (1-4). Default to 2 or 4 players.
    *   Store the selected player count in a variable in `main.ts`.
    *   Modify `drawGameState` to only display control configuration options for the selected number of players.
    *   Modify `initializeGame` to accept the desired player count and only create that many `Player` objects with appropriate default controls, colors, and starting positions.
    *   Adjust game over condition check to handle cases with fewer than 4 players (e.g., game ends when <= 1 player remains out of the *initial* count).
    *   **Success Criteria:** User can select 1-4 players on the start screen. The controls display updates. `initializeGame` creates the correct number of players. Game logic handles the variable player count correctly.

13. **Implement Round Scoring & Session Win Condition:**
    *   **(DEPRECATED - Replaced by 13a & 13b)** Add a `score` property (number) to the `Player` interface in `player.ts`.
    *   **(DEPRECATED)** Initialize player scores to 0 in `createPlayer`.
    *   **(DEPRECATED)** In `main.ts`, when the game state transitions after a round ends (`livingPlayersCount <= 1`):
        *   **(DEPRECATED)** Identify the winning player (if any) and increment their score.
        *   Check if the overall session win condition is met (highest score >= 30 AND difference between highest and second-highest score >= 2).
        *   If win condition met, transition `gameState` to `SessionOver`.
        *   Otherwise, transition `gameState` to `GameOver` as before.
    *   Ensure scores persist when restarting a round (calling `initializeGame` from `GameOver`), passing the latest scores.
    *   **Success Criteria:** The score of the round winner is incremented. Game transitions to `SessionOver` only when the 30 points / win-by-2 condition is met. Otherwise, it transitions to `GameOver`. Scores are maintained correctly between rounds.

**--- NEW SCORING SYSTEM TASKS ---**

13a. **Track Player Elimination Order:**
    *   Modify the game logic (likely in `main.ts` where collisions are handled) to record the order in which players are eliminated. This could involve storing player IDs in an array (`eliminationOrder`) as they are marked `isAlive = false`.
    *   Ensure the player(s) still alive at the end of the round are implicitly ranked highest.
    *   **Success Criteria:** After a round completes (`livingPlayersCount <= 1`), there is a data structure (e.g., `eliminationOrder` array) that accurately reflects the order players were eliminated, starting with the first player out.

13b. **Implement Rank-Based Scoring (3/2/1/0 pts) & Session Win Condition:**
    *   Add a `score` property (number) to the `Player` interface in `player.ts` if not already present. Initialize to 0 in `createPlayer`.
    *   In `main.ts`, when the game state transitions after a round ends (`livingPlayersCount <= 1`):
        *   Determine the final ranking of all players based on the `eliminationOrder` from Task 13a and which player(s) survived. The survivor(s) are ranked 1st. The last player in `eliminationOrder` is ranked next, then the second to last, etc.
        *   Award points based on rank: 1st gets 3 points, 2nd gets 2 points, 3rd gets 1 point, 4th and lower get 0 points. Add these points to the players' existing `score`.
        *   Check if the overall session win condition is met (highest score >= 30 AND difference between highest and second-highest score >= 2).
        *   If win condition met, transition `gameState` to `SessionOver`.
        *   Otherwise, transition `gameState` to `GameOver`.
    *   Ensure scores persist when restarting a round (calling `initializeGame` from `GameOver`), passing the latest scores.
    *   **Success Criteria:** Points (3/2/1/0) are correctly added to player scores based on their survival rank for the round. Game transitions to `SessionOver` only when the 30 points / win-by-2 condition is met after score calculation. Otherwise, it transitions to `GameOver`. Scores are maintained correctly between rounds.

14. **Implement Score & Session Over Display:**
    *   Update `drawGameState`:
        *   On the `GameOver` screen, display current scores for all players.
        *   Add a new drawing case for the `SessionOver` state.
        *   On the `SessionOver` screen, clearly announce the overall game winner and display the final scores.
    *   **Success Criteria:** Player scores are visible on the `GameOver` screen. A distinct `SessionOver` screen appears when the game is won, showing the winner and final scores.

15. **Handle Session Restart:**
    *   Modify `handleKeyDown`:
        *   When `gameState` is `SessionOver`, pressing Enter should reset the game completely: set `gameState` back to `WaitingToStart`, clear `lastScores`, potentially deselect game mode.
        *   Ensure pressing Enter when `gameState` is `GameOver` still just restarts the round (keeping scores).
    *   **Success Criteria:** Pressing Enter from the `SessionOver` screen returns the user to the initial `WaitingToStart` screen with scores reset. Pressing Enter from `GameOver` continues to the next round with scores intact.

**--- Tasks for Trail Hole Mechanic ---**

16. **Implement Trail Hole Generation:**
    *   Modify the `Player` state (in `player.ts`) to track if a hole is currently being generated (e.g., `isMakingHole: boolean`, `holeTimer: number`).
    *   In the player update logic (`updatePlayer` or similar in `main.ts`), add a mechanism to randomly decide *if* a hole should start forming (e.g., a small percentage chance each frame or after a certain distance traveled).
    *   When a hole starts, set `isMakingHole` to true and initialize `holeTimer` to determine its duration (e.g., number of frames or time).
    *   Decrement `holeTimer` each frame while `isMakingHole` is true. When it reaches zero, set `isMakingHole` back to false.
    *   Modify the trail drawing logic (`drawPlayer`) to *not* add new segments to the player's `path` (or visually skip drawing them) when `isMakingHole` is true for that player.
    *   **Success Criteria:** Players' trails occasionally have visible gaps appear for a short duration. The frequency and duration seem reasonable (needs tuning).

17. **Implement Hole Passthrough Collision:**
    *   This might be implicitly handled by Task 16 if holes are implemented by simply *not adding* segments to the `path`. Collision detection checks against the `path`, so non-existent segments won't cause collisions.
    *   **Success Criteria:** Players can move through the visible gaps in other players' trails without triggering a collision.

18. **Implement Collision Invincibility During Hole Generation:**
    *   Modify the collision detection logic in the main game loop (`main.ts`).
    *   When checking if `playerA` collides with `playerB`'s trail: if `playerA.isMakingHole` is currently true, *skip* the collision check against `playerB`'s trail (and potentially boundaries, TBD).
    *   **Important:** A player should still collide with trails if *they are not* the one currently making a hole.
    *   **Success Criteria:** If Player A hits Player B's trail *while Player A* has `isMakingHole` active, Player A does not die. If Player A hits Player B's trail while Player A is *not* making a hole, Player A dies as normal.

**--- Task for Randomized Starting Positions ---**

19. **Implement Randomized Starting Positions with Edge Buffer:**
    *   Locate the player creation loop within `initializeGame` in `src/main.ts`.
    *   Import `WIDTH`, `HEIGHT`, and `TURN_RADIUS` from `src/config.ts`.
    *   Calculate the safe zone boundaries: `minX = 2 * TURN_RADIUS`, `maxX = WIDTH - 2 * TURN_RADIUS`, `minY = 2 * TURN_RADIUS`, `maxY = HEIGHT - 2 * TURN_RADIUS`.
    *   Inside the loop, before calling `createPlayer`, generate:
        *   `randomX = Math.random() * (maxX - minX) + minX`
        *   `randomY = Math.random() * (maxY - minY) + minY`
        *   `randomAngle = Math.random() * 2 * Math.PI`
    *   Pass `randomX`, `randomY`, and `randomAngle` to the `createPlayer` function, replacing the previous logic that used predefined starting configurations based on player index.
    *   **Success Criteria:** When a new round starts (either initially or after `GameOver`), all active players appear at different, random locations and facing random directions. No player spawns very close to the canvas edges (visually verify the buffer zone seems correct, approximately `2 * TURN_RADIUS`).

**--- Tasks for Visual Appeal Enhancement ---**

20. **Refine Color Palette & Background:**
    *   Replace the solid black background with a subtle dark gradient (e.g., dark blue/purple to black).
    *   Review and potentially adjust the base colors used for UI elements (popups, leaderboard background) for better aesthetics.
    *   **Success Criteria:** The game background is no longer pure black. UI elements use potentially refined base colors, improving overall visual harmony.

21. **Improve Typography:**
    *   Select a suitable, readable web font (e.g., from Google Fonts).
    *   Add the necessary CSS (`<link>` in HTML or `@import` in CSS) to load the font.
    *   Update `ctx.font` assignments in `drawGameState` and `drawLeaderboard` to use the new font family.
    *   **Success Criteria:** All UI text (start screen, game over, leaderboard) uses the selected web font. Readability is maintained or improved.

22. **Enhance UI Element Styling:**
    *   Apply subtle gradients or borders to the backgrounds of buttons, popups (`GameOver`, `SessionOver`), and the leaderboard.
    *   Adjust padding and text alignment within these elements for a cleaner look.
    *   **Success Criteria:** UI elements look more polished and less flat. Text layout within elements is improved.

23. **(Optional) Add Simple Visual Polish:**
    *   Experiment with adding a subtle glow to player trails using `ctx.shadowBlur` and `ctx.shadowColor` in `drawTrail`.
    *   Consider adding a simple fade-in effect for the `GameOver` and `SessionOver` popups by animating `ctx.globalAlpha` over a few frames.
    *   **Success Criteria:** The game has minor visual enhancements (trail glow, UI fade-in) that improve the look without significantly degrading performance.

**--- Tasks for Persistent Settings ---**

24. **Save/Load Settings:**
    *   Define a data structure (e.g., an interface `GameSettings`) to hold the preferred player count and the array of control configurations.
    *   Implement a `saveSettings` function in `src/settings.ts` (new file) that takes `GameSettings` and saves it to `localStorage` as a JSON string. Include basic error handling (try/catch).
    *   Implement a `loadSettings` function in `src/settings.ts` that reads from `localStorage`, parses the JSON, and returns `GameSettings` or default values if nothing is saved or parsing fails. Include error handling.
    *   In `main.ts`, call `loadSettings` on initialization to get the starting `playerCount` and `playerControls`.
    *   Call `saveSettings` whenever the player count is changed or control configurations are updated in the `WaitingToStart` state.
    *   **Success Criteria:** Game starts with previously saved player count and controls. Changes made to these settings persist after reloading the page.

**--- Tasks for More Powerups ---**

25. **Define New Powerup Types:**
    *   Add new entries to the `PowerupType` enum/type in `src/powerup.ts`: `GHOST_MODE`, `THICK_TRAIL`, `CLEAR_OWN_TRAIL`, `RANDOM_TELEPORT`.
    *   Add corresponding entries to `POWERUP_CONSTANTS` for durations, colors, symbols, etc.
    *   Update `drawPowerup` to handle rendering the new powerup types.
    *   **Success Criteria:** New powerup types are defined in the code with associated constants and basic drawing logic.

26. **Implement New Powerup Effects & Visuals:**
    *   **Ghost Mode:** Modify `checkCollisions` in `src/player.ts` to ignore wall and trail collisions when the effect is active. Add visual indicator (e.g., player becomes semi-transparent).
    *   **Thick Trail:** Modify `drawTrail` in `src/player.ts` to use a larger `lineWidth` when the effect is active.
    *   **Clear Own Trail:** Implement logic in `applyPowerupEffect` (in `main.ts`) to instantly clear the collecting player's `path` array. This is an instantaneous effect.
    *   **Random Teleport:** Implement logic in `applyPowerupEffect` to calculate a new random safe position (similar to Task 19 logic) and update the player's position (`x`, `y`, and maybe head position). This is instantaneous.
    *   Update `applyPowerupEffect` and `updatePlayer` to handle activating/deactivating timed effects (`GHOST_MODE`, `THICK_TRAIL`) and triggering instantaneous ones (`CLEAR_OWN_TRAIL`, `RANDOM_TELEPORT`).
    *   Add necessary visual feedback in `drawPlayer` for new active effects.
    *   **Success Criteria:** Collecting each new powerup triggers its intended effect (passing through walls/trails, thicker trail, cleared trail, teleport) and associated visual cues. Timed effects expire correctly.

27. **Adjust Powerup Spawning/Balancing:**
    *   Review the powerup spawning logic (`spawnPowerup` in `main.ts`).
    *   Ensure the new powerup types are included in the random selection process.
    *   Potentially adjust spawn rates or probabilities if needed based on initial testing (e.g., maybe teleport or clear trail should be rarer).
    *   **Success Criteria:** New powerups appear during Arcade mode gameplay. The mix and frequency feel reasonable (subjective, may need later tuning).

**--- Tasks for Pause Functionality ---**

28. **Define Pause State & Input:**
    *   Add a `Paused` state to the `GameState` type/enum in `src/main.ts`.
    *   Modify `handleKeyDown` in `src/main.ts` to detect a specific key press (e.g., 'p') *only* when `gameState` is `Running`. If detected, change `gameState` to `Paused`.
    *   Modify `handleKeyDown` to detect the same key press when `gameState` is `Paused`. If detected, change `gameState` back to `Running`.
    *   **Success Criteria:** Pressing 'p' during gameplay transitions the `gameState` to `Paused` (verify via console log or debugger). Pressing 'p' again transitions back to `Running`.

29. **Suspend Game Logic:**
    *   In the main `gameLoop` function in `src/main.ts`, add a check at the beginning: if `gameState` is `Paused`, immediately `return` (or skip all update logic sections).
    *   **Success Criteria:** When the game is paused (state is `Paused`), players, trails, and powerups stop moving/updating. Game time effectively freezes.

30. **Implement Pause Visual Indicator:**
    *   Modify `drawGameState` in `src/main.ts` to add a case for the `Paused` state.
    *   In this case, first draw the regular game elements (players, trails, powerups, etc. - maybe by calling the drawing functions used in the 'Running' state or caching the last frame).
    *   Then, draw a semi-transparent overlay (e.g., `ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(...)`) covering the canvas.
    *   Draw text like "Paused" and "Press 'P' to Resume" in the center.
    *   **Success Criteria:** When paused, the game visuals freeze, and a clear "Paused" overlay with resume instructions is displayed.

31. **Handle Timers Across Pause:**
    *   Add variables in `main.ts` to track pause time: `pauseStartTime: number | null = null;`.
    *   When transitioning from `Running` to `Paused`, record `pauseStartTime = performance.now();`.
    *   When transitioning from `Paused` to `Running`:
        *   Calculate `pausedDuration = performance.now() - pauseStartTime;`.
        *   Iterate through all active players and add `pausedDuration` to the expiry timestamp of each effect in their `activeEffects` map.
        *   Iterate through `activePowerups` and add `pausedDuration` to their spawn timestamp (`createdAt`) to effectively extend their lifetime.
        *   Reset `pauseStartTime = null;`.
    *   **Success Criteria:** Active powerup effects (like speed boost, invincibility) and the lifetime of spawned powerups correctly resume their remaining duration after unpausing, accounting for the time spent paused.

## Project Status Board

- [x] Setup Basic HTML and Canvas
- [x] Implement Player Movement (Single Player)
- [x] Implement Trail Drawing
- [x] Implement Collision Detection
- [x] Implement Game Loop and State
- [x] Add Multiple Players and Controls (Initial 2 Player)
- [x] Implement Game Modes (Classic/Arcade)
- [x] Implement Powerup System (Arcade Mode)
    - [x] **8a. Review & Finalize Powerup Types**
    - [x] **8b. Implement Powerup Spawning & Despawning**
    - [x] **8c. Implement Player-Powerup Collision**
    - [x] **8d. Implement Powerup Effects (Instantaneous)** (N/A for current powerups)
    - [x] **8e. Implement Powerup Effects (Timed - Player State)**
    - [x] **8f. Implement Powerup Effects (Timed - Global/Other Players)**
    - [x] **8g. Visual Feedback for Powerups**
- [x] **Increase Player Count to 4 (Default)**
- [x] **Refactor Input Handling for Configurable Controls**
- [x] **Implement Basic Control Selection UI**
- [x] **Implement Player Count Selection**
- [x] **Implement Round Scoring & Session Win Condition** (DEPRECATED by 13a/13b)
- [x] **13a. Track Player Elimination Order**
- [x] **13b. Implement Rank-Based Scoring (3/2/1/0 pts) & Session Win Condition**
- [x] **14. Implement Score & Session Over Display**
- [x] **15. Handle Session Restart**
- [x] **16. Implement Trail Hole Generation**
- [x] **17. Implement Hole Passthrough Collision**
- [x] **18. Implement Collision Invincibility During Hole Generation**
- [x] **19. Implement Randomized Starting Positions with Edge Buffer**
- [x] **20. Refine Color Palette & Background**
- [x] **21. Improve Typography**
- [x] **22. Enhance UI Element Styling**
- [ ] **23. (Optional) Add Simple Visual Polish** (Skipped by user)
- [ ] **24. Save/Load Settings**
- [ ] **25. Define New Powerup Types**
- [ ] **26. Implement New Powerup Effects & Visuals**
- [ ] **27. Adjust Powerup Spawning/Balancing**
- [ ] **28. Define Pause State & Input**
- [ ] **29. Suspend Game Logic**
- [ ] **30. Implement Pause Visual Indicator**
- [ ] **31. Handle Timers Across Pause**

## Executor's Feedback or Assistance Requests

- **Task 1: Setup Basic HTML and Canvas** completed successfully. Verified by running `npm run dev` and observing the initial HTML structure, canvas, and console logs.

- **Task 2: Implement Player Movement (Single Player)** completed successfully. Verified visually: a single player dot moves and turns correctly based on Arrow key input, leaving an implicit trail (as `clearRect` is not yet active).

- **Task 3: Implement Trail Drawing** completed successfully. Verified visually: Player leaves a continuous trail, and the canvas clears correctly each frame.

- **Task 4: Implement Collision Detection** completed successfully. Verified visually: Player stops moving and head disappears upon hitting canvas boundaries or its own trail. Console logs confirm collisions.

- **Task 5: Implement Game Loop and State** completed successfully. Verified visually: Game starts in 'WaitingToStart', transitions to 'Running' on Enter, handles player movement/collision, transitions to 'GameOver' on collision, and restarts on Enter from GameOver state. State text is displayed appropriately.

- **Task 6: Add Multiple Players and Controls** completed successfully. Verified visually: Two players with distinct controls and colors operate correctly. Collision detection works between players and boundaries. Game Over state activates when only one player remains, displaying winner with a semi-transparent colored background square.

- **Task 7: Implement Game Modes (Classic/Arcade)** completed successfully. Verified visually: Start screen shows clickable buttons for Classic/Arcade modes. Selection is highlighted. Game only starts via Enter key after a mode is selected. Restarting from Game Over returns to mode selection with the last mode highlighted.

- **Task 9: Increase Player Count to 4** completed. Verified via code inspection and manual testing: `initializeGame` creates 4 players with distinct starts/colors; `playerControls` map in `player.ts` defines default keys for 4 players. Controls work.

- **Task 10: Refactor Input Handling for Configurable Controls** completed. Verified via code inspection: `updatePlayer` in `player.ts` already uses the `playerControls` map, meeting the task's success criteria.

- **Task 11: Implement Basic Control Selection UI** completed. Verified via manual testing: UI appears correctly in "WaitingToStart" state, allows changing keys for each player via button clicks and key presses, handles cancellation, and uses configured keys in-game. Layout issue fixed.

- **Task 12: Implement Player Count Selection** completed. Verified via manual testing: UI allows selecting 1-4 players, controls display updates accordingly, game initializes with the correct player count, and game logic functions correctly with variable players.

- **Task 13 (Deprecated): Implement Scoring System Logic & Win Condition** completed. Verified via console logs: Scores increment correctly, scores persist across rounds (GameOver), scores reset on new game (WaitingToStart), and game correctly transitions to SessionOver state only when win condition (>=30 & win by 2) is met, otherwise transitions to GameOver. **(Note: This implementation awarded +1 to the winner, needs update for rank-based scoring)**

- **Task 14 (Initial): Implement Score & Session Over Display** completed. Verified via manual testing: GameOver screen shows round scores. SessionOver screen appears when win condition met, shows the overall winner, final scores, and correct prompt. **(Note: Score display needs verification after rank-based scoring is implemented)**

- **Task 13a: Track Player Elimination Order** completed. Added `eliminationOrder: number[]` array to `main.ts`. It's cleared in `initializeGame` and player IDs are pushed onto it when `player.isAlive` is set to `false` in the game loop's collision check. Verified via console logs that the array correctly tracks the order of elimination.

- **Task 13b: Implement Rank-Based Scoring & Session Win Condition** completed. Modified `main.ts` end-of-round logic: calculates rank based on survivors and `eliminationOrder`; awards points (3/2/1/0); checks win condition (>=30 AND win by 2); transitions state correctly. Verified via console logs and manual testing across several rounds.

- **Task 14 (Final): Implement Score & Session Over Display** completed. Updated `drawGameState` in `main.ts`: ensured `GameOver` screen uses current player scores; modified `SessionOver` screen to fetch scores from `lastScores`, sort players by score, and display correctly. Verified visually in both states.

- **Task 15: Handle Session Restart** completed. Verified that the existing code in `handleKeyDown` for the `SessionOver` state already correctly resets the game to `WaitingToStart`, clears scores and players, and redraws the initial state when Enter is pressed. No code changes were necessary.

- **Task 16: Implement Trail Hole Generation** completed. Modified `src/player.ts`: added `isMakingHole` and `holeTimer` to `Player` interface/`createPlayer`; added logic in `updatePlayer` to randomly trigger hole state, manage timer, and conditionally skip adding path segments when `isMakingHole` is true. Verified visually: trails now have occasional gaps.

- **Task 17: Implement Hole Passthrough Collision** completed. Verified implicitly via Task 16 implementation: since path segments are not added during hole generation, collision checks against those missing segments naturally do not trigger. Players can visually pass through the gaps.

- **Task 18: Implement Collision Invincibility During Hole Generation** completed. Modified `checkCollisions` in `src/player.ts` to immediately return `false` if `player.isMakingHole` is true, skipping boundary and trail checks. Verified via manual testing: player does not die when hitting trails/boundaries while their own trail has a gap forming.

- **Task 8a: Review & Finalize Powerup Types** completed. Updated `src/powerup.ts`: removed `CLEAR_SCREEN`, updated `REVERSE_CONTROLS` description, added `POWERUP_CONSTANTS` object with durations/magnitudes, updated `drawPowerup`. Verified via code inspection.

- **Task 8b: Implement Powerup Spawning & Despawning** completed. Added filter logic in `main.ts` game loop to remove powerups from `activePowerups` based on `POWERUP_CONSTANTS.DEFAULT_LIFETIME_MS`. Verified existing logic already correctly handles Arcade-only spawning. Verified visually: powerups appear and disappear over time.

- **Task 8c: Implement Player-Powerup Collision** completed. Added collision check logic in `main.ts` game loop between living players and active powerups (Arcade mode only). Collected powerup IDs are tracked and used to filter `activePowerups` after the player loop. Verified via console logs on collection and visual disappearance of powerups.

- **Task 8d: Implement Powerup Effects (Instantaneous)** completed (N/A). None of the currently defined powerups have instantaneous effects, so no implementation was required for this step.

- **Task 8e: Implement Powerup Effects (Timed - Player State)** completed. Added `activeEffects` map to `Player` interface. Created `applyPowerupEffect` in `main.ts` to add expiry timestamps to this map upon collection. Modified `updatePlayer` to check/remove expired effects, apply speed boost/reversed controls. Modified `checkCollisions` to apply invincibility effect. Modified `drawTrail` to apply thin trail effect. Verified effects apply and expire correctly via manual testing and console logs.

- **Task 8f: Implement Powerup Effects (Timed - Global/Other Players)** completed. Verified that `applyPowerupEffect` correctly adds `SLOW_OTHERS` effect to other players' `activeEffects` map, and `updatePlayer` correctly checks this map and applies the speed reduction. Verified effect applies to other players and expires correctly via manual testing.

- **Task 8g: Visual Feedback for Powerups** completed. Modified `drawPlayer` in `src/player.ts` to add visual cues (outer colored circle, alpha pulse, color flash) for active effects like speed boost, invincibility (powerup or hole), slow, and reverse controls. Verified visually that indicators appear correctly when effects are active.

- **Task 19: Implement Randomized Starting Positions with Edge Buffer** completed. Calculated minimum turn radius based on max speed and turn rate. Modified `initializeGame` in `src/main.ts` to define a safe spawn area buffered by 2x this radius from the edges. Players are now created with random X, Y positions within this area and a random initial angle, replacing the fixed start positions.

- **Task 20: Refine Color Palette & Background** completed. Background changed to a dark gradient. Popup backgrounds changed to dark gradients with winner-color borders. Default button colors adjusted.

- **Task 21: Improve Typography** completed. Added Poppins font via Google Fonts link in `index.html`. Updated text drawing calls in `src/main.ts` to use Poppins font.

- **Task 22: Enhance UI Element Styling** completed. Added subtle vertical gradients to buttons on the `WaitingToStart` screen.

- **Task 23: (Optional) Add Simple Visual Polish** was skipped as per user request.

- **Task 24: Save/Load Settings** completed. Created `src/settings.ts` with `loadSettings` and `saveSettings` using `localStorage`. Added `setAllPlayerControls` to `src/player.ts`. Integrated loading on startup and saving on player count/control changes in `src/main.ts`. Verified functionality via user testing.

- **Task 25: Define New Powerup Types** completed. Added `GHOST_MODE`, `THICK_TRAIL`, `CLEAR_OWN_TRAIL`, `RANDOM_TELEPORT` to `PowerupType` in `src/powerup.ts`. Added corresponding entries to `POWERUP_CONSTANTS` (duration, color, symbol). Updated `drawPowerup` to use constants for color and symbol rendering.

- **Task 26: Implement New Powerup Effects & Visuals** completed. Modified `src/player.ts`: `checkCollisions` handles `GHOST_MODE`, `drawTrail` handles `THICK_TRAIL`, `drawPlayer` adds visual indicators for `GHOST_MODE` and `THICK_TRAIL`. Modified `src/main.ts`: `applyPowerupEffect` handles instantaneous effects (`CLEAR_OWN_TRAIL`, `RANDOM_TELEPORT`) and adds timed effects (`GHOST_MODE`, `THICK_TRAIL`) to `activeEffects`.

- **Task 27: Adjust Powerup Spawning/Balancing** completed. Added new powerup types to the random selection list in `spawnPowerup` in `src/main.ts`. Further balancing deferred pending playtesting.

*(No new feedback yet)*

## Lessons

*(No lessons learned yet)* 

# Phase 2: Online Multiplayer (Client-Server Architecture)

## Background and Motivation

To allow players to compete remotely, the game needs to be extended with online multiplayer capabilities. This involves transitioning from a purely client-side architecture to a client-server model where a central server manages the game state and facilitates communication between players.

## Architecture Overview

-   **Model:** Client-Server.
-   **Client (Frontend):** The existing HTML, CSS, and TypeScript code, responsible for rendering the game state received from the server and sending user input to the server. Hosted on **Netlify**.
-   **Server (Backend):** A Node.js application using TypeScript, responsible for managing WebSocket connections, running the authoritative game simulation (receiving inputs, updating state, detecting collisions), and broadcasting state updates to connected clients. Hosted on **Fly.io**.
-   **Communication Protocol:** WebSockets (`ws` library recommended for Node.js).
-   **Database (Optional):** Potentially Supabase (PostgreSQL) for features like user accounts, persistent leaderboards, or advanced matchmaking, but not strictly required for the core real-time gameplay loop.

## Key Challenges and Analysis

-   **State Synchronization:** Ensuring all clients have a consistent and reasonably up-to-date view of the game state despite network latency.
-   **Latency Handling:** Implementing strategies (e.g., server reconciliation, potentially client-side prediction if needed later) to mitigate the perceived effects of network delay on player movement and actions.
-   **Server-Side Game Logic:** Refactoring the core game simulation (movement, collision, powerups, scoring) to run authoritatively on the server.
-   **Network Code:** Efficiently serializing and deserializing game state and input messages sent over WebSockets.
-   **Backend Deployment & Management:** Setting up, configuring (Dockerfile, `fly.toml`), deploying, and managing the Node.js application on Fly.io.
-   **Scalability:** Designing the server logic to handle multiple simultaneous game rooms and players (Fly.io helps with scaling instances).
-   **Security:** Basic validation of messages received from clients to prevent trivial cheating or server crashes.

## High-level Task Breakdown (Phase 2)

**(To be started AFTER Phase 1 tasks 24-31 are complete)**

32. **Setup Backend Project (Node.js/TypeScript):**
    *   Create a new directory for the server code (e.g., `server/`).
    *   Initialize a Node.js project (`npm init`).
    *   Setup TypeScript (`tsconfig.json`).
    *   Install necessary dependencies (`typescript`, `ts-node`, `@types/node`, `ws`, `@types/ws`).
    *   Create basic server entry point (`src/server.ts`).
    *   **Success Criteria:** A basic Node.js/TypeScript project structure is created for the backend server.

33. **Implement Basic WebSocket Server:**
    *   In `server.ts`, use the `ws` library to create a WebSocket server.
    *   Handle basic connection events (`connection`, `message`, `close`, `error`).
    *   Log messages when clients connect and disconnect.
    *   **Success Criteria:** The Node.js server starts, listens for WebSocket connections, and logs client connection/disconnection events.

34. **Setup Fly.io App & Deployment:**
    *   Install `flyctl` CLI.
    *   Run `fly launch` within the `server/` directory to generate initial configuration (`fly.toml`, `Dockerfile`).
    *   Review and potentially adjust the `Dockerfile` (ensure correct Node version, `npm install`, build steps) and `fly.toml` (port configuration, health checks).
    *   Perform an initial deployment using `fly deploy`.
    *   **Success Criteria:** The basic WebSocket server is successfully deployed to Fly.io and is reachable (can be tested with a simple WebSocket client tool).

35. **Refactor Core Game Logic for Server:**
    *   Identify core game logic components from the client-side code (`player.ts`, `powerup.ts`, `config.ts`, parts of `main.ts` like collision checks, state updates) that need to run on the server.
    *   Copy/adapt these modules into the `server/src/` directory.
    *   Modify them to remove client-specific rendering logic and dependencies (e.g., canvas context).
    *   Create server-side representations of game entities (Players, Powerups) and game state.
    *   **Success Criteria:** Core game types, constants, and simulation logic (movement update, collision detection) exist and can be run within the Node.js server environment.

36. **Define Network Messages:**
    *   Define TypeScript interfaces for messages exchanged between client and server (e.g., `ClientInputMessage`, `ServerGameStateUpdate`, `PlayerJoin`, `GameStart`, `GameOver`, etc.).
    *   Include message types/identifiers to distinguish different kinds of messages.
    *   **Success Criteria:** Clear data structures are defined for all necessary client-server communication.

37. **Implement Server-Side Game Management:**
    *   Create logic on the server to manage game "rooms" or sessions.
    *   Handle players joining/leaving rooms.
    *   Implement the main server game loop: process inputs from clients in a room, update the authoritative game state for that room, check for collisions/wins.
    *   Periodically broadcast the relevant game state updates (using the defined messages) to all clients in a room.
    *   **Success Criteria:** Server can manage multiple game instances, process inputs, run the simulation, and broadcast state updates via WebSockets.

38. **Implement Client-Side Networking:**
    *   Modify the client-side code (`main.ts`) to establish a WebSocket connection to the deployed Fly.io server URL.
    *   Implement sending player input (key presses) to the server using the defined messages.
    *   Implement handling incoming game state updates from the server.
    *   Modify the client's rendering logic (`gameLoop`, `drawPlayer`, etc.) to display the state received from the server, instead of running its own simulation.
    *   **Success Criteria:** Client connects to the server, sends inputs, receives state updates, and renders the game based on server data. Multiple clients can connect and see each other move based on server updates.

39. **Implement Basic Matchmaking/Lobby:**
    *   (Server-side) Implement a simple system for players to find or create game rooms (e.g., join first available room, create new if none).
    *   (Client-side) Add basic UI elements for connecting and joining a game.
    *   **Success Criteria:** Players can successfully join a game session with other online players.

40. **Refine Synchronization & Latency Handling (Initial Pass):**
    *   Test gameplay with simulated or real network latency.
    *   Make initial adjustments to state update frequency or structure to improve perceived smoothness.
    *   (Advanced - Optional for later) Consider basic client-side prediction and server reconciliation if needed.
    *   **Success Criteria:** Online gameplay feels reasonably responsive and consistent across different clients.

**(Further tasks: Database integration for accounts/leaderboards, advanced matchmaking, cheat prevention, etc.)**

## Project Status Board

**--- Phase 1: Local Multiplayer & Enhancements ---**

// ... existing Phase 1 tasks ...
- [ ] **31. Handle Timers Across Pause**

**--- Phase 2: Online Multiplayer ---**

- [ ] **32. Setup Backend Project (Node.js/TypeScript)**
- [ ] **33. Implement Basic WebSocket Server**
- [ ] **34. Setup Fly.io App & Deployment**
- [ ] **35. Refactor Core Game Logic for Server**
- [ ] **36. Define Network Messages**
- [ ] **37. Implement Server-Side Game Management**
- [ ] **38. Implement Client-Side Networking**
- [ ] **39. Implement Basic Matchmaking/Lobby**
- [ ] **40. Refine Synchronization & Latency Handling (Initial Pass)**

## Executor's Feedback or Assistance Requests 
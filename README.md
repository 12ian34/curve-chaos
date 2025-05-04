# curve chaos

[![Netlify Status](https://api.netlify.com/api/v1/badges/0dd106cb-b1f2-4d87-b9ce-78225e56dbeb/deploy-status)](https://app.netlify.com/sites/curvechaos/deploys)

multiplayer game inspired by "Achtung, die Kurve!"

[https://curvechaos.netlify.app](https://curvechaos.netlify.app)

## how to play

### starting a game

1. Select the number of players (1-4) using the +/- buttons.
2. Optionally, click "Change" next to a player's control keys to rebind them.
3. Select either "Classic" or "Arcade" mode. In Arcade mode, collect power-ups for temporary advantages or disadvantages.
4. Press Enter to start the game.

### playing

- Use your assigned keys to turn left or right.
- Avoid hitting the window boundaries or any player's trail (including your own, except during temporary invincibility from holes or power-ups).
- Be the last player standing to win the round.

### winning

The first player to reach 30 points with a lead of at least 2 points wins the session.

## features

--
check .cursor/scratchpad.md for full planning and requirements doc, including future todos
--

*   **Multiplayer:** Supports 1-4 local players.
*   **Classic Mode:** Standard gameplay - avoid walls and trails.
*   **Arcade Mode:** Classic gameplay with added power-ups:
    *   Speed Boost (Self)
    *   Slow Others
    *   Thin Trail (Self)
    *   Invincibility (Self)
    *   Reverse Controls (Self)
*   **Random Names:** Players are assigned random names from various lists (English, Norwegian, Swedish, German).
*   **Configurable Controls:** Player controls can be re-bound via the main menu.
*   **Scoring System:** Points awarded based on survival rank each round (3/2/1/0).
*   **Session Play:** The game continues over multiple rounds until one player reaches 30 points with at least a 2-point lead.
*   **Responsive:** Uses the full browser window.
*   **Leaderboard:** Displays player names and scores persistently.

## todo

- more powerups
- online multiplayer
- simplify ui

## stack

- typescript
- vite
- html canvas
- css
- netlify

## developers

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/12ian34/curve-chaos.git
    cd curve-chaos
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
4.  Open your browser to the local address provided by Vite (usually `http://localhost:5173`).


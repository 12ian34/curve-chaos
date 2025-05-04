# curve chaos

[![Netlify Status](https://api.netlify.com/api/v1/badges/0dd106cb-b1f2-4d87-b9ce-78225e56dbeb/deploy-status)](https://app.netlify.com/sites/curvechaos/deploys)

A local multiplayer game inspired by the classic "Achtung, die Kurve!" built with TypeScript and HTML Canvas.

## Deployment

🚀 **Live Site:** [https://curvechaos.netlify.app](https://curvechaos.netlify.app)

## Features

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

## How to Play

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
5.  **Use the main menu:**
    *   Select the number of players (1-4) using the +/- buttons.
    *   Optionally, click "Change" next to a player's control keys to rebind them.
    *   Select either "Classic" or "Arcade" mode.
    *   Press Enter to start the game.
6.  **Gameplay:**
    *   Use your assigned keys to turn left or right.
    *   Avoid hitting the window boundaries or any player's trail (including your own, except during temporary invincibility from holes or power-ups).
    *   Be the last player standing to win the round.
    *   In Arcade mode, collect power-ups for temporary advantages or disadvantages.
7.  **Winning:** The first player to reach 30 points with a lead of at least 2 points wins the session.

## Controls (Defaults)

*   **Player 1:** Left Arrow / Right Arrow
*   **Player 2:** A / D
*   **Player 3:** J / L
*   **Player 4:** Numpad 4 / Numpad 6

*(Controls can be changed in the main menu before starting)*

## Development

*   Built with TypeScript and Vite.
*   Uses HTML Canvas for rendering.
*   Styling via plain CSS.
*   Includes basic power-up system. 

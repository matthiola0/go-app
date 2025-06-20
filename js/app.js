let currentPlayer = 'black';
let boardState = [];
let currentBoardSize = 9;
let previousBoardState = null;
let lastMoveWasPass = false;
let gameOver = false;

let player1Name = "Player 1";
let player2Name = "Player 2";
let gameMode = 'hvh';

// Modal DOM Elements - assigned in DOMContentLoaded
let gameOverModal, modalMessage, modalNewGameButton;

const PLAYER_MAP = { 'black': 1, 'white': 2, 'empty': 0 };
const COLOR_MAP = { 1: 'black', 2: 'white', 0: 'empty' };

const HOSHI_POINTS = {
  9:  [[2,2], [2,6], [4,4], [6,2], [6,6]],
  13: [[3,3], [3,9], [6,6], [9,3], [9,9]],
  19: [[3,3], [3,9], [3,15], [9,3], [9,9], [9,15], [15,3], [15,9], [15,15]]
};

// --- Helper Functions ---
function deepCopyBoard(board) {
  if (!board) return null;
  return board.map(row => [...row]);
}

function areBoardsEqual(board1, board2) {
  if (!board1 || !board2) return false;
  if (board1.length !== board2.length) return false;
  for (let i = 0; i < board1.length; i++) {
    if (board1[i].length !== board2[i].length) return false;
    for (let j = 0; j < board1[i].length; j++) {
      if (board1[i][j] !== board2[i][j]) return false;
    }
  }
  return true;
}

function updatePlayerTurnIndicator() {
  const indicator = document.getElementById('player-turn-indicator');
  if (indicator) {
    if (gameOver) {
      indicator.textContent = "Game Over";
    } else {
      const name = currentPlayer === 'black' ? player1Name : player2Name;
      indicator.textContent = `${name}'s Turn (${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)})`;
    }
  }
}

function initializeBoardState(size) {
  boardState = Array.from({ length: size }, () => Array(size).fill(PLAYER_MAP.empty));
  currentBoardSize = size;
  previousBoardState = null;
  lastMoveWasPass = false;
  gameOver = false;
}

// --- UI Update Functions ---
function getIntersectionDiv(r, c) {
  return document.querySelector(`.intersection[data-row='${r}'][data-col='${c}']`);
}

function addStoneToUI(r, c, playerColorName) { // playerColorName is 'black' or 'white'
  const iDiv = getIntersectionDiv(r, c);
  if (iDiv) {
    // Ensure no duplicate stones if logic elsewhere is faulty
    const existingStone = iDiv.querySelector('.stone');
    if (existingStone) existingStone.remove();

    const stone = document.createElement('div');
    stone.className = `stone ${playerColorName}-stone`;
    iDiv.appendChild(stone);
  }
}

function redrawStonesFromState() {
  // Remove all existing stone divs
  const allStoneDivs = document.querySelectorAll('.go-board .stone');
  allStoneDivs.forEach(stoneDiv => stoneDiv.remove());

  // Add stones based on boardState
  for (let r = 0; r < currentBoardSize; r++) {
    for (let c = 0; c < currentBoardSize; c++) {
      const playerValue = boardState[r][c];
      if (playerValue !== PLAYER_MAP.empty) {
        addStoneToUI(r, c, COLOR_MAP[playerValue]);
      }
    }
  }
}


function drawBoard(size) {
  console.log("drawBoard called with size:", size);
  console.log("HOSHI_POINTS for this size:", HOSHI_POINTS[size]);

  const boardContainer = document.getElementById('board-container');
  if (!boardContainer) { console.error("Board container not found!"); return; }

  initializeBoardState(size);
  boardContainer.innerHTML = ''; // Clear everything (lines, hoshi, stones)
  currentPlayer = 'black';

  const goBoard = document.createElement('div');
  goBoard.className = 'go-board';

  // Dynamically set board size
  if (size === 19) {
    goBoard.style.width = '570px'; // 19 * 30px
    goBoard.style.height = '570px';
  } else if (size === 13) {
    goBoard.style.width = '520px'; // 13 * 40px
    goBoard.style.height = '520px';
  } else { // Default for 9x9
    goBoard.style.width = '400px'; // 9 * ~44px
    goBoard.style.height = '400px';
  }

  goBoard.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  goBoard.style.gridTemplateRows = `repeat(${size}, 1fr)`;

  const hoshiForCurrentSize = HOSHI_POINTS[size] || [];

  // Create all intersection divs first
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const intersection = document.createElement('div');
      intersection.className = 'intersection';
      intersection.dataset.row = row;
      intersection.dataset.col = col;
      // Temporary log for verifying data attributes on a few cells (from previous logging task)
      // if (row < 1 && col < 2) {
      //     console.log(`[DEBUG] Intersection created: data-row=${intersection.dataset.row}, data-col=${intersection.dataset.col}`);
      // }
      intersection.addEventListener('click', handleIntersectionClick);
      goBoard.appendChild(intersection);
    }
  }
  boardContainer.appendChild(goBoard); // Append the board with all intersections

  // Now, add Hoshi points using the new detailed logging logic
  console.log(`[HOSHI LOGIC - ${size}x${size}] Accessing HOSHI_POINTS[${size}]:`, JSON.parse(JSON.stringify(hoshiForCurrentSize)));

  hoshiForCurrentSize.forEach(coord => {
    const r = coord[0];
    const c = coord[1];
    console.log(`[HOSHI LOGIC - ${size}x${size}] Processing hoshi coord: r=${r}, c=${c}`);

    const selector = `.intersection[data-row='${r}'][data-col='${c}']`;
    console.log(`[HOSHI LOGIC - ${size}x${size}] Querying for parent intersection with selector: "${selector}"`);

    const intersectionDiv = goBoard.querySelector(selector); // Query within the goBoard context
    console.log(`[HOSHI LOGIC - ${size}x${size}] Found intersectionDiv for (r=${r},c=${c}):`, intersectionDiv);

    if (intersectionDiv) {
      const hoshiDiv = document.createElement('div');
      hoshiDiv.className = `hoshi hoshi-${size}`;
      hoshiDiv.style.top = '50%';
      hoshiDiv.style.left = '50%';
      intersectionDiv.appendChild(hoshiDiv);
      console.log(`[HOSHI LOGIC - ${size}x${size}] Appended hoshiDiv to intersectionDiv. Hoshi classes: ${hoshiDiv.classList.toString()}. Parent intersection data: r=${intersectionDiv.dataset.row}, c=${intersectionDiv.dataset.col}`);
    } else {
      console.error(`[HOSHI LOGIC - ${size}x${size}] FAILED to find intersectionDiv for hoshi at r=${r}, c=${c} using selector: "${selector}"`);
    }
  });

  redrawStonesFromState(); // Initial draw of stones (none, but good practice)
  updatePlayerTurnIndicator(); // Call after everything is set up
  console.log(`Go board (${size}x${size}) drawn. Player: ${currentPlayer}. Mode: ${gameMode}.`);
}


// --- Game Logic Functions ---
function getGroup(r, c, playerValue, board) {
  const size = board.length;
  const group = { stones: [], liberties: new Set() };
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const queue = [{ r, c }];
  if(r < 0 || r >= size || c < 0 || c >= size || !board[r] || board[r][c] !== playerValue) {
      return { stones: [], liberties: 0};
  }
  visited[r][c] = true;
  group.stones.push({ r, c });
  const dr = [-1, 1, 0, 0], dc = [0, 0, -1, 1];

  while (queue.length > 0) {
    const curr = queue.shift();
    for (let i = 0; i < 4; i++) {
      const nr = curr.r + dr[i], nc = curr.c + dc[i];
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        if (board[nr][nc] === PLAYER_MAP.empty) group.liberties.add(`${nr},${nc}`);
        else if (board[nr][nc] === playerValue && !visited[nr][nc]) {
          visited[nr][nc] = true;
          group.stones.push({ r: nr, c: nc });
          queue.push({ r: nr, c: nc });
        }
      }
    }
  }
  return { stones: group.stones, liberties: group.liberties.size };
}

function simulateMove(r, c, playerValue, originalBoard) {
    let tempBoard = deepCopyBoard(originalBoard);
    if (!tempBoard) return null;
    tempBoard[r][c] = playerValue;

    const opponentValue = playerValue === PLAYER_MAP.black ? PLAYER_MAP.white : PLAYER_MAP.black;
    const dr = [-1, 1, 0, 0], dc = [0, 0, -1, 1];

    for (let i = 0; i < 4; i++) {
        const nr_adj = r + dr[i];
        const nc_adj = c + dc[i];
        if (nr_adj >= 0 && nr_adj < currentBoardSize && nc_adj >= 0 && nc_adj < currentBoardSize && tempBoard[nr_adj][nc_adj] === opponentValue) {
            const group = getGroup(nr_adj, nc_adj, opponentValue, tempBoard);
            if (group.liberties === 0) {
                group.stones.forEach(stone => tempBoard[stone.r][stone.c] = PLAYER_MAP.empty);
            }
        }
    }
    return tempBoard;
}

// checkCaptures now only modifies boardState. UI updates are handled by redrawStonesFromState.
function checkCaptures(r, c, playerValue, board) {
  const size = board.length;
  const opponentValue = playerValue === PLAYER_MAP.black ? PLAYER_MAP.white : PLAYER_MAP.black;
  let capturedAny = false;
  const dr = [-1, 1, 0, 0], dc = [0, 0, -1, 1];

  for (let i = 0; i < 4; i++) {
    const nr = r + dr[i], nc = c + dc[i];
    if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === opponentValue) {
      const group = getGroup(nr, nc, opponentValue, board);
      if (group.liberties === 0) {
        group.stones.forEach(stone => {
          board[stone.r][stone.c] = PLAYER_MAP.empty;
          capturedAny = true;
        });
        if (group.stones.length > 0) console.log(`Captured ${group.stones.length} ${COLOR_MAP[opponentValue]} stones.`);
      }
    }
  }
  return capturedAny; // Return true if any stones were captured
}

// --- AI Logic ---
function handleAITurn() {
    if (gameOver || currentPlayer !== 'white' || gameMode !== 'hva') return;

    console.log("AI's turn (Random AI)...");
    const aiPlayerValue = PLAYER_MAP.white;
    const useAdvancedAI = false;

    if (useAdvancedAI) {
        // ... (Advanced AI placeholder - unchanged from previous step) ...
        console.log("Advanced AI to make a move (not implemented, using random AI as fallback)");
    }

    let possibleMoves = [];
    for (let r_try = 0; r_try < currentBoardSize; r_try++) {
        for (let c_try = 0; c_try < currentBoardSize; c_try++) {
            if (boardState[r_try][c_try] === PLAYER_MAP.empty) {
                let tempBoardForValidation = simulateMove(r_try, c_try, aiPlayerValue, boardState);
                if (!tempBoardForValidation) continue;

                const ownGroup = getGroup(r_try, c_try, aiPlayerValue, tempBoardForValidation);
                if (ownGroup.liberties === 0) continue;
                if (areBoardsEqual(tempBoardForValidation, previousBoardState)) continue;

                possibleMoves.push({ r: r_try, c: c_try });
            }
        }
    }

    if (possibleMoves.length > 0) {
        const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        console.log(`Random AI places stone at (${move.r}, ${move.c})`);
        boardState[move.r][move.c] = aiPlayerValue;
        checkCaptures(move.r, move.c, aiPlayerValue, boardState); // Update boardState with captures
        redrawStonesFromState(); // Update UI based on new boardState
        previousBoardState = deepCopyBoard(boardState);
        lastMoveWasPass = false;
        currentPlayer = 'black';
        updatePlayerTurnIndicator();
    } else {
        console.log("Random AI has no valid moves, passing.");
        handlePassTurn();
    }
}

// --- Event Handlers ---
function handleIntersectionClick(event) {
  if (gameOver) {
    // console.log("Game is over. Board clicks disabled via gameOver flag.");
    // Optionally, briefly show the modal if it's somehow hidden but game is over
    if (gameOverModal && gameOverModal.style.display !== 'flex') {
        if(modalMessage) modalMessage.textContent = "遊戲已經結束。 (Game is already over.)";
        gameOverModal.style.display = 'flex';
    }
    return;
  }
  if (gameMode === 'hva' && currentPlayer === 'white') {
     // console.log("It's AI's turn. Board clicks disabled.");
     // alert("It's AI's turn."); // Alert can be annoying, console log might be enough
     return;
  }

  const intersection = event.currentTarget;
  const r = parseInt(intersection.dataset.row);
  const c = parseInt(intersection.dataset.col);

  if (boardState[r][c] !== PLAYER_MAP.empty) { return; }

  const playerValue = PLAYER_MAP[currentPlayer];

  // Ko Rule Check: Simulate the move on a temporary board
  const tempBoardForKo = simulateMove(r, c, playerValue, boardState);
  if (areBoardsEqual(tempBoardForKo, previousBoardState)) {
    alert("Invalid move: Ko rule violation.");
    return;
  }

  // Tentatively place stone and check for suicide
  const boardStateBeforeMove = deepCopyBoard(boardState); // For reverting suicide
  boardState[r][c] = playerValue; // Place stone
  checkCaptures(r, c, playerValue, boardState); // Check captures (updates boardState)

  const ownGroup = getGroup(r, c, playerValue, boardState);
  if (ownGroup.liberties === 0) {
    // Suicide: Revert boardState to before this move AND its captures
    boardState = boardStateBeforeMove;
    redrawStonesFromState(); // Redraw based on the reverted state
    alert("Invalid move: Suicide is not allowed.");
    return;
  }

  // Valid move
  redrawStonesFromState(); // Final UI update for the turn
  previousBoardState = deepCopyBoard(boardState);
  lastMoveWasPass = false;

  currentPlayer = (currentPlayer === 'black') ? 'white' : 'black';
  updatePlayerTurnIndicator();

  if (gameMode === 'hva' && currentPlayer === 'white' && !gameOver) {
    document.getElementById('board-container').style.pointerEvents = 'none';
    setTimeout(() => {
        handleAITurn();
        document.getElementById('board-container').style.pointerEvents = 'auto';
    }, 500);
  }
}

function handlePassTurn() {
  if (gameOver) {
    // console.log("Game is over. Pass Turn button disabled via gameOver flag.");
    if (gameOverModal && gameOverModal.style.display !== 'flex') { // Ensure modal is visible if game is over
        if (modalMessage) modalMessage.textContent = "遊戲已經結束。 (Game is already over.)";
        gameOverModal.style.display = 'flex';
    }
    return;
  }

  const passingPlayerName = currentPlayer === 'black' ? player1Name : player2Name;

  // AI Passing Logic (if AI calls this function)
  if (gameMode === 'hva' && currentPlayer === 'white') {
    console.log("AI Passes.");
    if (lastMoveWasPass) { // Human passed, then AI passes
        gameOver = true;
        if (modalMessage) modalMessage.textContent = `${player1Name} (執黑) 與 ${player2Name} (AI執白) 雙方連續 PASS，遊戲結束。\n請自行判斷結果。`;
        if (gameOverModal) gameOverModal.style.display = 'flex';
    } else { // Human made a move, AI now passes
        lastMoveWasPass = true; // AI's pass is the first of a potential pair
    }
    currentPlayer = 'black'; // Turn goes to human (Black)
    previousBoardState = null;
    updatePlayerTurnIndicator(); // Update to show human's turn or "Game Over"
    return;
  }

  // Human Player Passing Logic
  if (lastMoveWasPass) { // Opponent (Human or AI) passed, now this Human player passes
    gameOver = true;
    console.log(`Game Over: ${passingPlayerName} passed after opponent passed.`);
    let opponentName = currentPlayer === 'black' ? player2Name : player1Name; // The one who passed first
    if (modalMessage) modalMessage.textContent = `${passingPlayerName} 與 ${opponentName} 雙方連續 PASS，遊戲結束。\n請自行判斷結果。`;
    if (gameOverModal) gameOverModal.style.display = 'flex';
  } else { // This Human player is the first to pass
    lastMoveWasPass = true;
    console.log(`${passingPlayerName} passed.`);
    currentPlayer = (currentPlayer === 'black') ? 'white' : 'black'; // Switch turn
    previousBoardState = null;
  }
  updatePlayerTurnIndicator(); // Update to show next player's turn or "Game Over"

  // If it's now AI's turn (after Human passed)
  if (gameMode === 'hva' && currentPlayer === 'white' && !gameOver) {
      document.getElementById('board-container').style.pointerEvents = 'none';
      setTimeout(() => {
          handleAITurn();
          document.getElementById('board-container').style.pointerEvents = 'auto';
      }, 500);
  }
}

function handleStartGame() {
  gameMode = document.getElementById('game-mode').value;
  player1Name = document.getElementById('player1-name').value || "Player 1";

  if (gameMode === 'hva') {
    player2Name = "AI Opponent";
    document.getElementById('player2-name').value = player2Name;
    document.getElementById('player2-name').disabled = true;
  } else {
    player2Name = document.getElementById('player2-name').value || "Player 2";
    document.getElementById('player2-name').disabled = false;
  }

  document.getElementById('player-setup').style.display = 'none';
  document.getElementById('game-area').style.display = 'block';
  document.getElementById('board-container').style.pointerEvents = 'auto';

  drawBoard(currentBoardSize || 9);
}

function handleNewGame() {
    document.getElementById('player-setup').style.display = 'flex'; // Assuming setup is flex
    document.getElementById('game-area').style.display = 'none';

    const boardContainer = document.getElementById('board-container');
    if(boardContainer) boardContainer.innerHTML = ''; // Clear board visuals

    // Reset game state variables
    currentBoardSize = 9; // Reset to default size
    // boardState will be reset by initializeBoardState in drawBoard
    previousBoardState = null;
    lastMoveWasPass = false;
    gameOver = false;
    currentPlayer = 'black'; // Reset current player

    // Reset player name input fields (optional)
    // document.getElementById('player1-name').value = "Player 1";
    // document.getElementById('player2-name').value = "Player 2";
    // document.getElementById('game-mode').value = "hvh";
    // const p2NameInput = document.getElementById('player2-name');
    // p2NameInput.disabled = false;

    console.log("New game setup initiated.");
}


document.addEventListener('DOMContentLoaded', () => {
  // Assign modal elements from DOM
  gameOverModal = document.getElementById('game-over-modal');
  modalMessage = document.getElementById('modal-message');
  modalNewGameButton = document.getElementById('modal-new-game');

  const select9x9Button = document.getElementById('select-9x9');
  const select13x13Button = document.getElementById('select-13x13');
  const select19x19Button = document.getElementById('select-19x19');
  const passButton = document.getElementById('pass-turn');
  const startGameButton = document.getElementById('start-game');
  const newGameButton = document.getElementById('new-game');
  const gameModeSelect = document.getElementById('game-mode');

  if (modalNewGameButton) {
    modalNewGameButton.addEventListener('click', () => {
      if (gameOverModal) gameOverModal.style.display = 'none'; // Hide modal
      handleNewGame(); // Call existing new game function
    });
  }

  if (gameModeSelect) {
    gameModeSelect.addEventListener('change', (e) => {
      const p2NameInput = document.getElementById('player2-name');
      if (e.target.value === 'hva') {
        p2NameInput.value = "AI Opponent";
        p2NameInput.disabled = true;
      } else {
        p2NameInput.value = player2Name === "AI Opponent" ? "Player 2" : player2Name;
        p2NameInput.disabled = false;
      }
    });
  }

  if (startGameButton) startGameButton.addEventListener('click', handleStartGame);
  if (newGameButton) newGameButton.addEventListener('click', handleNewGame);

  const boardSizeButtonHandler = (size) => {
    currentBoardSize = size;
    if (document.getElementById('game-area').style.display === 'block') {
      drawBoard(size);
    }
  };

  if (select9x9Button) select9x9Button.addEventListener('click', () => boardSizeButtonHandler(9));
  if (select13x13Button) select13x13Button.addEventListener('click', () => boardSizeButtonHandler(13));
  if (select19x19Button) select19x19Button.addEventListener('click', () => boardSizeButtonHandler(19));

  if (passButton) passButton.addEventListener('click', handlePassTurn);
});

// 連接到後端 Socket.IO 伺服器
const socket = io();

// --- 前端狀態變數 ---
let currentPlayer = 'black';
let boardState = [];
let currentBoardSize = 9;
let gameOver = false;

// --- 介面相關的變數 ---
let player1Name = "Player 1"; // 這些將來可以替換為玩家帳號
let player2Name = "Player 2";
let gameOverModal, modalMessage, modalNewGameButton;

const PLAYER_MAP = { 'black': 1, 'white': 2, 'empty': 0 };
const COLOR_MAP = { 1: 'black', 2: 'white', 0: 'empty' };
const HOSHI_POINTS = {
  9:  [[2,2], [2,6], [4,4], [6,2], [6,6]],
  13: [[3,3], [3,9], [6,6], [9,3], [9,9]],
  19: [[3,3], [3,9], [3,15], [9,3], [9,9], [9,15], [15,3], [15,9], [15,15]]
};

// --- Helper and UI Functions ---

function updatePlayerTurnIndicator() {
  const indicator = document.getElementById('player-turn-indicator');
  if (indicator) {
    if (gameOver) {
      indicator.textContent = "遊戲結束";
    } else {
      const name = currentPlayer === 'black' ? player1Name : player2Name;
      indicator.textContent = `${name}的回合 (${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)})`;
    }
  }
}

function getIntersectionDiv(r, c) {
  return document.querySelector(`.intersection[data-row='${r}'][data-col='${c}']`);
}

function addStoneToUI(r, c, playerColorName) {
  const iDiv = getIntersectionDiv(r, c);
  if (iDiv) {
    const existingStone = iDiv.querySelector('.stone');
    if (existingStone) existingStone.remove();
    const stone = document.createElement('div');
    stone.className = `stone ${playerColorName}-stone`;
    iDiv.appendChild(stone);
  }
}

function redrawStonesFromState() {
  const allStoneDivs = document.querySelectorAll('.go-board .stone');
  allStoneDivs.forEach(stoneDiv => stoneDiv.remove());

  if (!boardState || boardState.length === 0) return;

  currentBoardSize = boardState.length;
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
    currentBoardSize = size;
    const boardContainer = document.getElementById('board-container');
    if (!boardContainer) { console.error("Board container not found!"); return; }

    boardContainer.innerHTML = '';
    const goBoard = document.createElement('div');
    goBoard.className = 'go-board';

    if (size === 19) {
      goBoard.style.width = '570px'; goBoard.style.height = '570px';
    } else if (size === 13) {
      goBoard.style.width = '520px'; goBoard.style.height = '520px';
    } else {
      goBoard.style.width = '400px'; goBoard.style.height = '400px';
    }

    goBoard.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    goBoard.style.gridTemplateRows = `repeat(${size}, 1fr)`;
    const hoshiForCurrentSize = HOSHI_POINTS[size] || [];

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const intersection = document.createElement('div');
        intersection.className = 'intersection';
        intersection.dataset.row = row;
        intersection.dataset.col = col;
        intersection.addEventListener('click', handleIntersectionClick);
        goBoard.appendChild(intersection);
      }
    }
    boardContainer.appendChild(goBoard);

    hoshiForCurrentSize.forEach(coord => {
        const intersectionDiv = goBoard.querySelector(`.intersection[data-row='${coord[0]}'][data-col='${coord[1]}']`);
        if (intersectionDiv) {
          const hoshiDiv = document.createElement('div');
          hoshiDiv.className = `hoshi hoshi-${size}`;
          hoshiDiv.style.top = '50%';
          hoshiDiv.style.left = '50%';
          intersectionDiv.appendChild(hoshiDiv);
        }
    });

    redrawStonesFromState();
    updatePlayerTurnIndicator();
}

// --- Event Handlers ---

function handleIntersectionClick(event) {
  if (gameOver) return;
  const intersection = event.currentTarget;
  const r = parseInt(intersection.dataset.row);
  const c = parseInt(intersection.dataset.col);
  socket.emit('placeStone', { r, c });
}

function handlePassTurn() {
  if(gameOver) return;
  socket.emit('passTurn');
}

function handleNewGame() {
    socket.emit('newGame', { size: 9 });
}

// --- Socket.IO Event Listeners ---
socket.on('gameStateUpdate', (roomState) => {
    if (currentBoardSize !== roomState.boardSize) {
        drawBoard(roomState.boardSize);
    }
    boardState = roomState.boardState;
    currentPlayer = roomState.currentPlayer;
    gameOver = roomState.gameOver;
    redrawStonesFromState();
    updatePlayerTurnIndicator();
});

socket.on('invalidMove', (data) => {
    alert(`無效的移動: ${data.message}`);
});

socket.on('waitingForPlayer', (data) => {
    const indicator = document.getElementById('player-turn-indicator');
    indicator.textContent = data.message;
});

socket.on('gameStart', (data) => {
    alert(data.message);
});

socket.on('gameOver', (data) => {
    gameOver = true;
    updatePlayerTurnIndicator();
    const indicator = document.getElementById('player-turn-indicator');
    indicator.textContent = data.message;
    alert(data.message);
});

socket.on('opponentDisconnected', (data) => {
    gameOver = true;
    updatePlayerTurnIndicator();
    alert(data.message);
});


document.addEventListener('DOMContentLoaded', () => {
    gameOverModal = document.getElementById('game-over-modal');
    modalMessage = document.getElementById('modal-message');
    modalNewGameButton = document.getElementById('modal-new-game');

    const passButton = document.getElementById('pass-turn');
    const newGameButton = document.getElementById('new-game');
    
    // 重新綁定切換棋盤尺寸的按鈕
    const select9x9Button = document.getElementById('select-9x9');
    const select13x13Button = document.getElementById('select-13x13');
    const select19x19Button = document.getElementById('select-19x19');
    
    document.getElementById('player-setup').style.display = 'none';
    document.getElementById('game-area').style.display = 'block';

    // 讓「新遊戲」按鈕預設開 9x9
    if (newGameButton) newGameButton.addEventListener('click', () => socket.emit('newGame', { size: 9 }));
    if (passButton) passButton.addEventListener('click', handlePassTurn);
    
    // 讓尺寸按鈕也能開新局
    if (select9x9Button) select9x9Button.addEventListener('click', () => socket.emit('newGame', { size: 9 }));
    if (select13x13Button) select13x13Button.addEventListener('click', () => socket.emit('newGame', { size: 13 }));
    if (select19x19Button) select19x19Button.addEventListener('click', () => socket.emit('newGame', { size: 19 }));

    // 初始繪製棋盤，之後會由 gameStateUpdate 修正為正確尺寸和狀態
    drawBoard(currentBoardSize);
});
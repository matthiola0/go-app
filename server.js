const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// --- 從 app.js 搬移過來的常數和遊戲邏輯 ---

const PLAYER_MAP = { 'black': 1, 'white': 2, 'empty': 0 };
const COLOR_MAP = { 1: 'black', 2: 'white', 0: 'empty' };

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
  return capturedAny;
}

// --- 伺服器端的遊戲狀態管理 (改為多房間模式) ---
let rooms = {}; // 存放所有房間的狀態
let playerRooms = {}; // 存放每個玩家所在的房間ID

function createNewRoomState(size = 9) {
    return {
        boardState: Array.from({ length: size }, () => Array(size).fill(PLAYER_MAP.empty)),
        currentPlayer: 'black',
        previousBoardState: null,
        lastMoveWasPass: false,
        gameOver: false,
        boardSize: size,
        players: {}, // { 'socketId': 'black' | 'white' }
    };
}

// 告訴 Express 去服務 public 資料夾中的靜態檔案
app.use(express.static('public'));

// --- Socket.IO 連接與事件處理 ---
io.on('connection', (socket) => {
    console.log('一個新玩家連接上了: ' + socket.id);

    // 簡易配對邏輯
    let waitingRoomId = Object.keys(rooms).find(roomId => Object.keys(rooms[roomId].players).length === 1);

    if (waitingRoomId) {
        // 加入等待中的房間
        const room = rooms[waitingRoomId];
        socket.join(waitingRoomId);
        playerRooms[socket.id] = waitingRoomId;
        room.players[socket.id] = 'white'; // 第二個加入的玩家是白棋

        console.log(`玩家 ${socket.id} 加入房間 ${waitingRoomId}，遊戲開始！`);
        io.to(waitingRoomId).emit('gameStart', { message: '對手已加入，遊戲開始！' });
        io.to(waitingRoomId).emit('gameStateUpdate', room);
    } else {
        // 創建新房間
        const roomId = uuidv4();
        socket.join(roomId);
        playerRooms[socket.id] = roomId;
        rooms[roomId] = createNewRoomState();
        rooms[roomId].players[socket.id] = 'black'; // 第一個創建房間的玩家是黑棋

        console.log(`玩家 ${socket.id} 創建並加入新房間 ${roomId}`);
        socket.emit('waitingForPlayer', { message: '等待對手加入...' });
    }

    // --- 監聽遊戲事件 ---
    socket.on('placeStone', (data) => {
        const roomId = playerRooms[socket.id];
        if (!roomId) return;
        const room = rooms[roomId];
        if (room.gameOver) return;

        // 驗證是否輪到此玩家
        const playerColor = room.players[socket.id];
        if (playerColor !== room.currentPlayer) {
            socket.emit('invalidMove', { message: '還沒輪到你' });
            return;
        }

        const { r, c } = data;
        const playerValue = PLAYER_MAP[room.currentPlayer];

        if (room.boardState[r][c] !== PLAYER_MAP.empty) {
            socket.emit('invalidMove', { message: '此處已有棋子' });
            return;
        }

        const boardStateBeforeMove = deepCopyBoard(room.boardState);
        const tempBoardForKo = deepCopyBoard(room.boardState);
        tempBoardForKo[r][c] = playerValue;
        checkCaptures(r,c,playerValue, tempBoardForKo);

        // 打劫 (Ko Rule)**
        if (areBoardsEqual(tempBoardForKo, room.previousBoardState)) {
             socket.emit('invalidMove', { message: '無效的移動：違反打劫規則！' });
             return;
        }

        room.boardState[r][c] = playerValue;
        checkCaptures(r, c, playerValue, room.boardState);

        const ownGroup = getGroup(r, c, playerValue, room.boardState);
        if (ownGroup.liberties === 0) {
            room.boardState = boardStateBeforeMove;
            socket.emit('invalidMove', { message: '此為禁入點 (自殺)' });
            return;
        }

        // 移動有效，更新房間狀態
        room.previousBoardState = boardStateBeforeMove;
        room.lastMoveWasPass = false;
        room.currentPlayer = (room.currentPlayer === 'black') ? 'white' : 'black';
        io.to(roomId).emit('gameStateUpdate', room);
    });

    socket.on('passTurn', () => {
        const roomId = playerRooms[socket.id];
        if (!roomId) return;
        const room = rooms[roomId];
        if (room.gameOver) return;

        console.log(`玩家 ${socket.id} 在房間 ${roomId} 中選擇 PASS`);

        if (room.lastMoveWasPass) {
            // 遊戲結束
            room.gameOver = true;
            io.to(roomId).emit('gameOver', { message: '雙方連續 PASS，遊戲結束。請自行計分。'});
        } else {
            // 第一次 PASS
            room.lastMoveWasPass = true;
            room.currentPlayer = (room.currentPlayer === 'black') ? 'white' : 'black';
            io.to(roomId).emit('gameStateUpdate', room);
        }
    });
    
    socket.on('newGame', (data) => {
        const roomId = playerRooms[socket.id];
        if (!roomId || !rooms[roomId]) return;
        
        const room = rooms[roomId];
        const newSize = (data && data.size) ? data.size : 9; // 從前端接收尺寸，預設為9

        console.log(`房間 ${roomId} 請求開始一個 ${newSize}x${newSize} 的新遊戲`);
        
        const originalPlayers = room.players;
        rooms[roomId] = createNewRoomState(newSize); // 使用新尺寸創建遊戲
        rooms[roomId].players = originalPlayers;
        
        io.to(roomId).emit('gameStart', { message: '新遊戲已開始！'});
        io.to(roomId).emit('gameStateUpdate', rooms[roomId]);
    });


    socket.on('disconnect', () => {
        console.log('一個玩家斷線了: ' + socket.id);
        const roomId = playerRooms[socket.id];
        if (roomId && rooms[roomId]) {
            // 通知房間內的其他玩家
            socket.to(roomId).emit('opponentDisconnected', { message: '你的對手已斷線，遊戲結束。' });
            // 刪除房間
            delete rooms[roomId];
        }
        delete playerRooms[socket.id];
    });
});

server.listen(PORT, () => {
    console.log(`伺服器正在 http://localhost:${PORT} 上運行`);
});
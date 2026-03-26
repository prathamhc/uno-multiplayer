// ═══════════════════════════════════════════════════════════
//  UNO MULTIPLAYER — CLIENT APPLICATION
// ═══════════════════════════════════════════════════════════

(() => {
  'use strict';

  // ─── State ───────────────────────────────────────────────
  const state = {
    userId: localStorage.getItem('uno-userId') || generateId(),
    nickname: localStorage.getItem('uno-nickname') || '',
    roomCode: null,
    roomData: null,
    gameState: null,
    socket: null,
    maxPlayers: 4,
    pendingWildCardId: null,
  };

  // Persist userId
  localStorage.setItem('uno-userId', state.userId);

  function generateId() {
    return 'u_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  // ─── DOM Elements ────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    auth: $('#screen-auth'),
    lobby: $('#screen-lobby'),
    waiting: $('#screen-waiting'),
    game: $('#screen-game'),
  };

  // ─── Screen Navigation ──────────────────────────────────
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ─── Server URL (configurable for split deployment) ─────
  // Set window.__SERVER_URL before this script loads, or it defaults to same-origin
  const SERVER_URL = window.__SERVER_URL || '';

  // ─── Socket Connection ──────────────────────────────────
  function connectSocket() {
    if (state.socket && state.socket.connected) return;

    state.socket = io(SERVER_URL, {
      auth: {
        userId: state.userId,
        nickname: state.nickname,
      },
    });

    state.socket.on('connect', () => {
      console.log('[Socket] Connected:', state.socket.id);
    });

    state.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      showToast('Disconnected from server', 'error');
    });

    state.socket.on('room:updated', (data) => {
      state.roomData = data;
      renderWaitingRoom();
    });

    state.socket.on('game:state', (data) => {
      state.gameState = data;
      if (data.phase === 'playing') {
        showScreen('game');
        renderGame();
      }
      if (data.phase === 'finished') {
        renderGame();
        showGameOver(data.winner);
      }
    });

    state.socket.on('game:event', (event) => {
      showToast(event.message, getEventToastType(event.type));
    });

    state.socket.on('game:error', (error) => {
      showToast(error.message || error, 'error');
    });
  }

  function getEventToastType(type) {
    switch (type) {
      case 'win': return 'success';
      case 'uno-call': return 'warning';
      case 'uno-penalty': return 'error';
      case 'card-played': return 'info';
      case 'drew': return 'info';
      default: return 'info';
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  AUTH SCREEN
  // ═══════════════════════════════════════════════════════════
  const nicknameInput = $('#nickname-input');
  const btnEnter = $('#btn-enter');

  if (state.nickname) {
    nicknameInput.value = state.nickname;
  }

  btnEnter.addEventListener('click', () => {
    const name = nicknameInput.value.trim();
    if (!name) {
      nicknameInput.focus();
      showToast('Please enter a nickname!', 'warning');
      return;
    }
    state.nickname = name;
    localStorage.setItem('uno-nickname', name);
    connectSocket();
    showScreen('lobby');
  });

  nicknameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnEnter.click();
  });

  // ═══════════════════════════════════════════════════════════
  //  LOBBY SCREEN
  // ═══════════════════════════════════════════════════════════
  const maxPlayersValue = $('#max-players-value');
  const btnPlayersDown = $('#btn-players-down');
  const btnPlayersUp = $('#btn-players-up');
  const btnCreateRoom = $('#btn-create-room');
  const btnJoinRoom = $('#btn-join-room');
  const roomCodeInput = $('#room-code-input');
  const btnBackLobby = $('#btn-back-lobby');

  btnPlayersDown.addEventListener('click', () => {
    if (state.maxPlayers > 2) {
      state.maxPlayers--;
      maxPlayersValue.textContent = state.maxPlayers;
    }
  });

  btnPlayersUp.addEventListener('click', () => {
    if (state.maxPlayers < 10) {
      state.maxPlayers++;
      maxPlayersValue.textContent = state.maxPlayers;
    }
  });

  btnCreateRoom.addEventListener('click', () => {
    if (!state.socket || !state.socket.connected) {
      connectSocket();
      setTimeout(() => createRoom(), 500);
      return;
    }
    createRoom();
  });

  function createRoom() {
    state.socket.emit('room:create', { maxPlayers: state.maxPlayers }, (response) => {
      if (response.success) {
        state.roomCode = response.code;
        showScreen('waiting');
        showToast(`Room ${response.code} created!`, 'success');
      } else {
        showToast(response.error || 'Failed to create room', 'error');
      }
    });
  }

  btnJoinRoom.addEventListener('click', () => {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (code.length !== 4) {
      showToast('Enter a 4-character room code', 'warning');
      roomCodeInput.focus();
      return;
    }
    if (!state.socket || !state.socket.connected) {
      connectSocket();
      setTimeout(() => joinRoom(code), 500);
      return;
    }
    joinRoom(code);
  });

  roomCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnJoinRoom.click();
  });

  function joinRoom(code) {
    state.socket.emit('room:join', { code }, (response) => {
      if (response.success) {
        state.roomCode = response.code;
        showScreen('waiting');
        showToast(`Joined room ${response.code}!`, 'success');
      } else {
        showToast(response.error || 'Failed to join room', 'error');
      }
    });
  }

  btnBackLobby.addEventListener('click', () => {
    showScreen('auth');
  });

  // ═══════════════════════════════════════════════════════════
  //  WAITING ROOM
  // ═══════════════════════════════════════════════════════════
  const roomCodeDisplay = $('#room-code-display');
  const playersList = $('#players-list');
  const btnReady = $('#btn-ready');
  const btnStartGame = $('#btn-start-game');
  const btnLeaveRoom = $('#btn-leave-room');

  function renderWaitingRoom() {
    const data = state.roomData;
    if (!data) return;

    // Room code
    const chars = roomCodeDisplay.querySelectorAll('.code-char');
    const code = data.code || '----';
    chars.forEach((el, i) => {
      el.textContent = code[i] || '-';
    });

    // Players
    const avatarColors = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#7c4dff', '#ff6d00', '#00bfa5', '#d500f9', '#ff1744', '#00b0ff'];

    playersList.innerHTML = data.players.map((p, i) => `
      <div class="player-item">
        <div class="player-avatar" style="background: ${avatarColors[i % avatarColors.length]}">
          ${p.nickname.charAt(0).toUpperCase()}
        </div>
        <div class="player-info">
          <div class="player-name">${escapeHtml(p.nickname)}</div>
          <div class="player-tag">${p.userId === data.hostId ? '👑 Host' : 'Player'}</div>
        </div>
        <div class="ready-badge ${p.isReady ? 'ready' : 'not-ready'}">
          ${p.isReady ? '✓ Ready' : 'Not Ready'}
        </div>
      </div>
    `).join('');

    // Ready / Start buttons
    const myPlayer = data.players.find(p => p.userId === state.userId);
    const isHost = data.hostId === state.userId;
    const allReady = data.players.every(p => p.isReady);

    btnReady.textContent = myPlayer?.isReady ? 'Unready' : 'Ready Up';
    btnReady.className = `btn ${myPlayer?.isReady ? 'btn-secondary' : 'btn-primary'} btn-large`;

    if (isHost) {
      btnStartGame.style.display = 'inline-flex';
      btnStartGame.disabled = !allReady || data.players.length < 2;
    } else {
      btnStartGame.style.display = 'none';
    }
  }

  btnReady.addEventListener('click', () => {
    state.socket.emit('room:ready', { code: state.roomCode });
  });

  btnStartGame.addEventListener('click', () => {
    state.socket.emit('room:start', { code: state.roomCode }, (response) => {
      if (!response.success) {
        showToast(response.error || 'Cannot start game', 'error');
      }
    });
  });

  btnLeaveRoom.addEventListener('click', () => {
    state.socket.emit('room:leave', { code: state.roomCode });
    state.roomCode = null;
    state.roomData = null;
    showScreen('lobby');
  });

  // ═══════════════════════════════════════════════════════════
  //  GAME SCREEN
  // ═══════════════════════════════════════════════════════════

  function renderGame() {
    const gs = state.gameState;
    if (!gs) return;

    renderOpponents(gs);
    renderTableCenter(gs);
    renderPlayerHand(gs);
    renderTurnIndicator(gs);
  }

  // ── Opponents ────────────────────────────────────────────
  function renderOpponents(gs) {
    const area = $('#opponents-area');
    const avatarColors = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#7c4dff', '#ff6d00', '#00bfa5', '#d500f9', '#ff1744', '#00b0ff'];

    const opponents = gs.players.filter((_, i) => i !== gs.myIndex);
    area.innerHTML = opponents.map((p, i) => {
      const originalIndex = gs.players.indexOf(p);
      const isCurrent = p.isCurrentTurn;
      const canChallenge = p.cardCount === 1 && !p.saidUno;

      return `
        <div class="opponent-card ${isCurrent ? 'is-current' : ''} ${p.saidUno && p.cardCount === 1 ? 'has-uno' : ''}">
          <div class="opponent-avatar" style="background: ${avatarColors[originalIndex % avatarColors.length]}">
            ${p.nickname.charAt(0).toUpperCase()}
          </div>
          <div class="opponent-info">
            <div class="opponent-name">${escapeHtml(p.nickname)}</div>
            <div class="opponent-cards">${p.cardCount} card${p.cardCount !== 1 ? 's' : ''}${p.saidUno ? ' 🔴' : ''}</div>
          </div>
          ${canChallenge ? `<button class="challenge-btn" onclick="window.__challengeUno('${p.userId}')">UNO?</button>` : ''}
        </div>
      `;
    }).join('');
  }

  // Global challenge handler
  window.__challengeUno = function(targetUserId) {
    state.socket.emit('game:challenge-uno', { code: state.roomCode, targetUserId });
  };

  // ── Table Center ─────────────────────────────────────────
  function renderTableCenter(gs) {
    // Deck count
    $('#deck-count').textContent = `${gs.deckCount} cards`;

    // Direction arrow
    const dirArrow = $('.direction-arrow');
    if (gs.direction === 'counter-clockwise') {
      dirArrow.classList.add('counter-clockwise');
    } else {
      dirArrow.classList.remove('counter-clockwise');
    }

    // Discard pile
    const discardPile = $('#discard-pile');
    if (gs.topCard) {
      discardPile.innerHTML = renderCardHTML(gs.topCard, false);
    }

    // Active color indicator
    const colorIndicator = $('#active-color-indicator');
    if (gs.chosenColor && gs.chosenColor !== 'wild') {
      colorIndicator.style.display = 'block';
      colorIndicator.className = `active-color-indicator color-${gs.chosenColor}`;
      $('#active-color-text').textContent = `Active: ${gs.chosenColor}`;
    } else {
      colorIndicator.style.display = 'none';
    }

    // Draw stack
    const drawStackIndicator = $('#draw-stack-indicator');
    if (gs.drawStack > 0) {
      drawStackIndicator.style.display = 'block';
      $('#draw-stack-count').textContent = `+${gs.drawStack}`;
    } else {
      drawStackIndicator.style.display = 'none';
    }
  }

  // ── Player Hand ──────────────────────────────────────────
  function renderPlayerHand(gs) {
    const handEl = $('#player-hand');
    const isMyTurn = gs.myIndex === gs.currentPlayerIndex;
    const topCard = gs.topCard;

    handEl.innerHTML = gs.myHand.map((card, i) => {
      const playable = isMyTurn && canPlayCard(card, topCard, gs.chosenColor, gs.drawStack);
      return renderCardHTML(card, true, playable, i);
    }).join('');

    // Bind click events
    handEl.querySelectorAll('.card[data-card-id]').forEach(el => {
      el.addEventListener('click', () => {
        if (!el.classList.contains('playable')) return;
        const cardId = el.dataset.cardId;
        playCard(cardId);
      });
    });

    // UNO button pulse when hand is at 2 cards
    const btnUno = $('#btn-uno');
    if (gs.myHand.length === 2) {
      btnUno.classList.add('pulse');
    } else {
      btnUno.classList.remove('pulse');
    }

    // Draw button highlight
    const btnDraw = $('#btn-draw-card');
    if (isMyTurn) {
      btnDraw.classList.add('highlight');
    } else {
      btnDraw.classList.remove('highlight');
    }
  }

  function canPlayCard(card, topCard, chosenColor, drawStack) {
    if (!topCard) return true;

    // If draw stack is active
    if (drawStack && drawStack > 0) {
      if (topCard.value === 'draw2') return card.value === 'draw2';
      if (topCard.value === 'wild-draw4') return card.value === 'wild-draw4';
    }

    // Wild always playable
    if (card.color === 'wild') return true;

    const activeColor = chosenColor || topCard.color;
    return card.color === activeColor || card.value === topCard.value;
  }

  function playCard(cardId) {
    const card = state.gameState.myHand.find(c => c.id === cardId);
    if (!card) return;

    // If wild card, show color picker
    if (card.color === 'wild') {
      state.pendingWildCardId = cardId;
      showColorPicker();
      return;
    }

    state.socket.emit('game:play-card', {
      code: state.roomCode,
      cardId,
    }, (response) => {
      if (!response.success) {
        showToast(response.error || 'Cannot play card', 'error');
      }
    });
  }

  // ── Turn Indicator ───────────────────────────────────────
  function renderTurnIndicator(gs) {
    const turnIndicator = $('#turn-indicator');
    const turnText = $('#turn-text');
    const isMyTurn = gs.myIndex === gs.currentPlayerIndex;

    if (gs.phase === 'finished') {
      turnText.textContent = 'Game Over!';
      turnIndicator.className = 'turn-indicator not-my-turn';
    } else if (isMyTurn) {
      turnText.textContent = "Your Turn!";
      turnIndicator.className = 'turn-indicator my-turn';
    } else {
      const currentPlayer = gs.players[gs.currentPlayerIndex];
      turnText.textContent = `${currentPlayer.nickname}'s turn`;
      turnIndicator.className = 'turn-indicator not-my-turn';
    }
  }

  // ── Draw Card ────────────────────────────────────────────
  $('#btn-draw-card').addEventListener('click', () => {
    if (!state.gameState) return;
    state.socket.emit('game:draw-card', { code: state.roomCode }, (response) => {
      if (!response.success) {
        showToast(response.error || 'Cannot draw', 'error');
      }
    });
  });

  // Also allow clicking the draw pile
  $('#draw-pile').addEventListener('click', () => {
    if (!state.gameState) return;
    state.socket.emit('game:draw-card', { code: state.roomCode }, (response) => {
      if (!response.success) {
        showToast(response.error || 'Cannot draw', 'error');
      }
    });
  });

  // ── Say UNO ──────────────────────────────────────────────
  $('#btn-uno').addEventListener('click', () => {
    if (!state.gameState) return;
    state.socket.emit('game:say-uno', { code: state.roomCode });
  });

  // ═══════════════════════════════════════════════════════════
  //  COLOR PICKER
  // ═══════════════════════════════════════════════════════════
  const colorPickerModal = $('#color-picker-modal');

  function showColorPicker() {
    colorPickerModal.style.display = 'flex';
  }

  function hideColorPicker() {
    colorPickerModal.style.display = 'none';
  }

  $$('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.dataset.color;
      hideColorPicker();

      if (state.pendingWildCardId) {
        state.socket.emit('game:play-card', {
          code: state.roomCode,
          cardId: state.pendingWildCardId,
          chosenColor: color,
        }, (response) => {
          if (!response.success) {
            showToast(response.error || 'Cannot play card', 'error');
          }
        });
        state.pendingWildCardId = null;
      }
    });
  });

  // Close on overlay click
  colorPickerModal.addEventListener('click', (e) => {
    if (e.target === colorPickerModal) {
      hideColorPicker();
      state.pendingWildCardId = null;
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  GAME OVER
  // ═══════════════════════════════════════════════════════════
  const gameOverModal = $('#game-over-modal');

  function showGameOver(winner) {
    $('#winner-text').textContent = `${winner} wins! 🎉`;
    gameOverModal.style.display = 'flex';
  }

  $('#btn-back-to-lobby').addEventListener('click', () => {
    gameOverModal.style.display = 'none';
    state.gameState = null;
    state.roomCode = null;
    state.roomData = null;
    showScreen('lobby');
  });

  // ═══════════════════════════════════════════════════════════
  //  CARD RENDERING
  // ═══════════════════════════════════════════════════════════

  function renderCardHTML(card, interactive = false, playable = false, index = 0) {
    const colorClass = `card-${card.color}`;
    const playableClass = interactive && playable ? 'playable' : '';
    const dataAttr = interactive ? `data-card-id="${card.id}"` : '';
    const dealStyle = `animation-delay: ${index * 0.05}s`;

    const valueDisplay = getCardValueDisplay(card);
    const cornerText = getCardCornerText(card);

    return `
      <div class="card ${colorClass} ${playableClass} dealing" ${dataAttr} style="${dealStyle}">
        <div class="card-inner-oval"></div>
        <span class="card-corner card-corner-tl">${cornerText}</span>
        <span class="card-value">${valueDisplay.main}</span>
        ${valueDisplay.label ? `<span class="card-label">${valueDisplay.label}</span>` : ''}
        <span class="card-corner card-corner-br">${cornerText}</span>
      </div>
    `;
  }

  function getCardValueDisplay(card) {
    switch (card.value) {
      case 'skip': return { main: '⊘', label: 'SKIP' };
      case 'reverse': return { main: '⇄', label: 'REV' };
      case 'draw2': return { main: '+2', label: 'DRAW' };
      case 'wild': return { main: '✦', label: 'WILD' };
      case 'wild-draw4': return { main: '+4', label: 'WILD' };
      default: return { main: card.value, label: '' };
    }
  }

  function getCardCornerText(card) {
    switch (card.value) {
      case 'skip': return '⊘';
      case 'reverse': return '⇄';
      case 'draw2': return '+2';
      case 'wild': return '★';
      case 'wild-draw4': return '+4';
      default: return card.value;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  TOAST NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════
  function showToast(message, type = 'info') {
    const container = $('#toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  // ═══════════════════════════════════════════════════════════
  //  UTILITIES
  // ═══════════════════════════════════════════════════════════
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── Init ────────────────────────────────────────────────
  // Auto-login if nickname is stored
  if (state.nickname) {
    nicknameInput.value = state.nickname;
  }

  console.log('🃏 UNO Multiplayer client loaded');
})();

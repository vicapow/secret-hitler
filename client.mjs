// @flow

/* :: declare var io: () => any; */
/* :: import type { Message } from './types'; */

import { assert } from './utils.mjs';

function checkIsMobile() {
  var ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
}

function getRoleMessage(me, game) {
  const isHitler = game.hitler === (me && me.id);
  const isFacist = me && me.role === 'fascist';
  const fascists = game.players
    .filter(player => player.role === 'fascist' && (player.id !== (me && me.id)));
  if (isHitler) {
    if (game.players.length <= 6) {
      return `You're Hitler! The other facists are: ${fascists.map(f => f.name).join(', ')}.`;
    } else {
      return `You're Hitler! Because this game has 7 or more players, you'll have to guess who the other fascists are.`;
    }
  }
  if (isFacist) {
    const withoutHitler = fascists.filter(fascist => fascist.id !== game.hitler);
    const hitler = fascists.filter(fascist => fascist.id === game.hitler)[0];
    if (withoutHitler.length > 0) {
      return `You're a facist. The other facists are: ${withoutHitler.map(f => f.name).join(', ')} and Hitler is ${hitler.name}`;
    } else {
      return `You're a facist and Hitler is ${hitler.name}`;
    }
  }
  return `You're a liberal`;
}

function getPlayer(playerId, game) {
  const index = game.players.reduce((accum, player, index) => {
    if (player.id === playerId) {
      return index;
    }
    return accum;
  }, -1);
  if (index === -1) {
    return undefined;
  }
  return game.players[index];
}

// Get or create a playerId.
const urlParams = new URLSearchParams(window.location.search);
const isHand = urlParams.get('isHand') === 'true' || checkIsMobile();
const isDebug = urlParams.get('debug') !== null;
const playerId /*: string | void */ = isHand && (urlParams.get('playerId') || window.localStorage.getItem('playerId') || String(Math.random())) || undefined;
let game;

if (isHand) {
  window.localStorage.setItem('playerId', playerId);
}

const getElementById = document.getElementById.bind(document);
const getElementsByClassName = document.getElementsByClassName.bind(document);
const socket = io();

function sendMessage(type, body) {
  console.log(type, body);
  socket.emit('message', { type, body });
}

getElementById('start').onclick = (e) => sendMessage('START_GAME');

getElementById('hand__reveal_role').onclick = (e) => {
  sendMessage('REVEAL_ROLE', { playerId });
}

getElementById('name').onkeyup = (e) => {
  const name = e.currentTarget.value;
  sendMessage('UPDATE_PLAYER_NAME', { name, playerId });
}

socket.on('fail', failMessage => {
  throw new Error(failMessage);
  // TODO ?
});

socket.on('message', (message /*: Message */) => {
  let player;
  if (message.type === 'UPDATE_GAME_STATE') {
    game = message.body.game;
    player = game && getPlayer(playerId, game) || undefined;
    if (isDebug) {
      getElementById('debug').innerHTML = JSON.stringify(game, null, 2);
    }
    if (!player && isHand && !game.isStarted) {
      socket.emit('message', {
        type: 'PLAYER_JOIN',
        body: { playerId }
      });
    }
  }
  const canJoin = game.isStarted === false && game.players.length <= 10;
  const canStart = game.isStarted === false && game.players.length >= 5;
  const isObserver = game.isStarted && !game.players.find(player => player.id === playerId);
  if (isHand) {
    // Hand
    getElementById('hand').style.display = 'block';
    getElementById('boardgame').style.display = 'none';
    getElementById('start').style.display = canStart ? '' : 'none';
    getElementById('hand__reveal_role').style.display = !isObserver && game.isStarted ? '' : 'none';
    getElementById('name').readOnly = false;
    getElementById('name').style.display = isObserver ? 'none' : '';
    getElementById('name').value = player && player.name || '';
    getElementById('hand__role').innerText = getRoleMessage(player, game);
    getElementById('hand__role').style.display = player && player.revealRole ? '' : 'none';
  } else {
    // Board
    getElementById('hand').style.display = 'none';
    getElementById('boardgame').style.display = 'block';
    getElementById('start').style.display = 'none';
    getElementById('name').style.display = 'none';
  }
  [...getElementsByClassName('status')].map(element => {
    if (canStart) {
      element.innerText = `We've got enough players. If you're all ready, someone click start`;
    } else if (game.isStarted === false) {
      element.innerText = `Waiting for more players to join...`;
    } else if (isObserver && isHand) {
      element.innerText = `There is already a game in progress. You'll need to wait until the next game to join.`;
    } else {
      element.innerText = 'The game has begun! Checkout your role by clicking "reveal"';
    }
  });
  const playersElement = getElementById('boardgame__players');
  playersElement.innerHTML = `<ul>
    ${game.players.map((player, index) => `<ul>
        <h1>
          <div class="sh__icon sh__icon__${index}"></div>
          <span>${player.name}</span>
          ${player.seenRole ? `<span>✔️</span>` : ``}
        </h1>
    </ul>`).join('\n')}
  </ul>`;
});

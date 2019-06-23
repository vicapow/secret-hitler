// @flow

import fs from 'fs';
import socketIO from 'socket.io';
import http from 'http';
import express from 'express';
import next from 'next';
import { playerSetup, policies } from './rules.mjs';
import originalUpdate from './game.mjs';
/* :: import type { Game, Player, Phase, Message } from './types.mjs'; */

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const removeWhenLeavingPreGame = false;

const port = 3000;
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({dev});
const nextHandler = nextApp.getRequestHandler();

let game /*: Game */ = initGame(Date.now());

function update(state, message, now) {
  const nextState = originalUpdate(state, message, now);
  console.log(JSON.stringify(message, null, 2));
  console.log(JSON.stringify(nextState, null, 2));
  return nextState;
}

function createPolicies(policies) {
  const cards = [];
  let id = 0;
  for (let i = 0; i < policies.fascist; i++) {
    id = id + 1;
    cards.push({ id: String(id), type: 'fascist', location: 'deck' });
  }
  for (let i = 0; i < policies.liberal; i++) {
    id = id + 1;
    cards.push({ id: String(id), type: 'liberal', location: 'deck' });
  }
  return cards;
}

function initGame(now /*: number */)/*: Game */ {
  try {
    return JSON.parse(fs.readFileSync('./state.json').toString());
  } catch (e) {
    return {
      isStarted: false,
      hitler: undefined,
      phase: { name: undefined, timestamp: now },
      isVoting: false,
      presidentCandidate: undefined,
      chancellorCandidate: undefined,
      electedPresident: undefined,
      electedChancellor: undefined,
      players: [],
      policies: createPolicies(policies)
    };
  }
}

function broadcastGameState(game /*: Game */) {
  console.log('update...');
  io.emit('message', {
    type: 'UPDATE_GAME_STATE',
    body: { game }
  });
  fs.writeFileSync('./state.json', JSON.stringify(game, null, 2));
}

setInterval(() => {
  game = update(game, {type: 'CLOCK_TICK'}, Date.now());
  broadcastGameState(game);
}, 1000);

function getRandomUnmatchedPlayer(game) {
  const unmatched = game.players.filter(player => player.role === undefined);
  const randomIndex = Math.floor(Math.random() * unmatched.length);
  return unmatched[randomIndex];
}

io.on('connection', socket => {

  console.log('a client connected');

  broadcastGameState(game);

  socket.on('disconnect', () => {
    if (!game.isStarted) {
      // The game hasn't begin. Go ahead and remove this clients
      // player.
      if (removeWhenLeavingPreGame) {
        game = {
          ...game,
          players: game.players.filter(player => {
            player.id !== socket.playerId;
          })
        };
      }
      broadcastGameState(game);
    }
  });

  function sendMessage(message /*: Message */) {
    socket.emit('message', message);
  }

  socket.on('message', (message /*: Message */) => {
    console.log(message.type, message);
    if (message.type === 'PLAYER_JOIN') {
      const player = game.players.find(player => player.id === message.body.playerId);
      if (player) {
        socket.playerId = player.id;
      } else {
        socket.playerId = message.body.playerId;
      }
    }
    game = update(game, message, Date.now());
    broadcastGameState(game);
  });
});

nextApp.prepare().then(() => {
  app.get('*', (req, res) => {
    return nextHandler(req, res);
  });
  console.log('listen to server');
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});



// @flow

import fs from 'fs';
import express from 'express';
import socketIO from 'socket.io';
import http from 'http';
import * as rules from './rules.mjs';
import { assert } from './utils.mjs';
/* :: import type { Game, Player, Phase, Message } from './types.mjs'; */
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let game /*: Game */ = initGame();

function initGame()/*: Game */ {
  try {
    return JSON.parse(fs.readFileSync('./state.json').toString());
  } catch (e) {
    return {
      isStarted: false,
      hitler: undefined,
      phase: undefined,
      isVoting: false,
      presidentialCandidate: undefined,
      chancellorCandidate: undefined,
      electedPresident: undefined,
      electedChancellor: undefined,
      players: [],
    };
  }
}

function broadcastGameState() {
  console.log(game);
  io.emit('message', {
    type: 'UPDATE_GAME_STATE',
    body: { game }
  });
  fs.writeFileSync('./state.json', JSON.stringify(game, null, 2));
}

function getRandomUnmatchedPlayer(game) {
  const unmatched = game.players.filter(player => player.role === '');
  const randomIndex = Math.floor(Math.random() * unmatched.length);
  return unmatched[randomIndex];
}

function getRandomPlayer(game) {
  const randomIndex = Math.floor(Math.random() * game.players.length);
  return game.players[randomIndex];
}

function getPlayer(playerId, game) {
  const index = game.players.reduce((accum, player, index) => {
    if (player.id === playerId) {
      return index;
    }
    return accum;
  }, -1);
  assert(index !== -1);
  return game.players[index];
}

function startGame() {
  const hitler = getRandomUnmatchedPlayer(game);
  hitler.role = 'fascist';
  game.hitler = hitler.id;
  const numFascists = rules.playerSetup[String(game.players.length)].fascists;
  for (let i = 0; i < numFascists; i++) {
    getRandomUnmatchedPlayer(game).role = 'fascist';
  }
  game.players.forEach(player => {
    if (player.role === undefined) {
      player.role = 'liberal';
    }
  });
  game.isStarted = true;
  game.phase = 'ELECTION_START';
  game.presidentialCandidate = getRandomPlayer(game).id;
}

io.on('connection', socket => {

  console.log('a client connected');

  broadcastGameState();

  socket.on('disconnect', () => {
    if (!game.isStarted) {
      // The game hasn't begin. Go ahead and remove this clients
      // player.
      game.players = game.players.filter(player => {
        player.id !== socket.playerId;
      });
      broadcastGameState();
    }
  });

  function sendMessage(message /*: Message */) {
    socket.emit('message', message);
  }

  socket.on('message', (message /*: Message */) => {
    console.log(message.type, message);
    if (message.type === 'START_GAME') {
      if (!game.isStarted) {
        startGame();
      }
    } else if (message.type === 'PLAYER_JOIN') {
      const player = game.players.find(player => player.id === message.body.playerId);
      if (player) {
        socket.playerId = player.id;
        // retreive an existing player
        sendMessage({ type: 'PLAYER_JOINED', body: { player } });
      } else {
        // create a player
        // TODO Handle error case for when game has already started.
        if (!game.isStarted) {
          socket.playerId = message.body.playerId;
          game.players.push({
            id: message.body.playerId,
            name: `Player ${game.players.length + 1}`,
            role: undefined,
            revealRole: false,
            seenRole: false,
            vote: undefined,
          });
        }
      }
    } else if (message.type === 'UPDATE_PLAYER_NAME') {
      const { name, playerId } = message.body;
      getPlayer(playerId, game).name = name;
    } else if (message.type === 'REVEAL_ROLE') {
      const { playerId } = message.body;
      const player = getPlayer(playerId, game);
      player.revealRole = !player.revealRole;
      player.seenRole = true;
    }
    broadcastGameState();
  });
});

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/index.html')
});

app.get('/client.mjs', (req, res) => {
  res.sendFile(process.cwd() + '/client.mjs')
});

app.get('/utils.mjs', (req, res) => {
  res.sendFile(process.cwd() + '/utils.mjs')
});

server.listen(3000)

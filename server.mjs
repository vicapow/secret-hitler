// @flow

import fs from 'fs';
import socketIO from 'socket.io';
import http from 'http';
import express from 'express';
import next from 'next';
import { playerSetup, policies } from './rules.mjs';
import { assert } from './utils.mjs';
/* :: import type { Game, Player, Phase, Message } from './types.mjs'; */

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const removeWhenLeavingPreGame = false;

const port = 3000;
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({dev});
const nextHandler = nextApp.getRequestHandler();

let game /*: Game */ = initGame();

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
      policies: createPolicies(policies)
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

function pluckRandom<T>(array /*: $ReadOnlyArray<T> */) /* : [T, $ReadOnlyArray<T>] */ {
  const randomIndex = Math.floor(Math.random() * array.length);
  const resultArray = [...array.slice(0, randomIndex), ...array.slice(randomIndex + 1) ];
  return [array[randomIndex], resultArray];
}

function getRandomUnmatchedPlayer(game) {
  const unmatched = game.players.filter(player => player.role === undefined);
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

function startGame(game /*: Game */)/*: Game */ {
  const oldPlayers = game.players;
  let [hitler, unmatchedPlayers] = pluckRandom(game.players);
  let matchedPlayers /* : $ReadOnlyArray<Player> */ = [hitler];
  let player;
  hitler = { ...hitler, role: 'fascist' };
  const numFascists = playerSetup[String(game.players.length)].fascists;
  for (let i = 0; i < numFascists; i++) {
    [player, unmatchedPlayers] = pluckRandom(unmatchedPlayers);
    player = {...player, role: 'fascist' };
    matchedPlayers = [...matchedPlayers, player];
  }
  matchedPlayers = [
    ...matchedPlayers,
    ...unmatchedPlayers.map(player => ({ ...player, role: 'liberal' }))
  ];
  return {
    ...game,
    isStarted: true,
    phase: 'VIEW_ROLES',
    players: matchedPlayers,
    presidentialCandidate: getRandomPlayer(game).id,
    hitler: hitler.id,
  };
}

io.on('connection', socket => {

  console.log('a client connected');

  broadcastGameState();

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
        game = startGame(game);
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
          const newPlayer = {
            id: message.body.playerId,
            name: `Player ${game.players.length + 1}`,
            role: undefined,
            revealRole: false,
            seenRole: false,
            vote: undefined,
          };
          game = {
            ...game,
            players: [...game.players, newPlayer]
          };
        }
      }
    } else if (message.type === 'UPDATE_PLAYER_NAME') {
      const { name, playerId } = message.body;
      game = {
        ...game,
        players: game.players.map(player => {
          if (player.id === playerId) {
            return { ...player, name };
          }
          return player;
        })
      };
    } else if (message.type === 'REVEAL_ROLE') {
      const { playerId } = message.body;
      const player = getPlayer(playerId, game);
      game = {
        ...game,
        players: game.players.map(player => {
          if (player.id === playerId) {
            return { ...player, revealRole: !player.revealRole, seenRole: true };
          }
          return player;
        })
      };
      if (game.phase === 'VIEW_ROLES') {
        const unseenPlayers = game.players.filter(player => !player.seenRole);
        if (unseenPlayers.length === 0) {
          // All players have seen their role. move to election phase.
          game = {
            ...game,
            phase: 'ELECTION_START'
          }
          if (game.chancellorCandidate === undefined) {
            game = {
              ...game,
              chancellorCandidate: getRandomPlayer(game).id
            };
          }
        }
      }
    } else if (message.type === 'SELECT_CHANCELLOR_CANDIDATE') {
      const { playerId } = message.body;
      game = {
        ...game,
        chancellorCandidate: playerId,
        phase: 'VOTE_ON_TICKET'
      };
    } else if (message.type === 'VOTE_ON_TICKET') {
      const { playerId, vote } = message.body;
      const player = getPlayer(playerId, game);
      game = {
        ...game,
        players: game.players.map(player => {
          if (player.id === playerId) {
            return { ...player, vote };
          }
          return player;
        })
      }
      const notVoted = game.players.filter(player => player.vote === undefined);
      if (notVoted.length === 0) {
        game = {
          ...game,
          phase: 'REVEAL_TICKET_RESULTS'
        };
        setTimeout(() => {
          const jas = game.players.reduce((jas /* :  number */, player) => {
            return player.vote === 'ja' ? (jas + 1) : jas;
          }, 0);
          const win = jas > (game.players.length / 2);
          if (win) {
            game = {
              ...game,
              phase: 'LEGISLATIVE_SESSION_START',
              electedChancellor: game.chancellorCandidate,
              electedPresident: game.presidentialCandidate,
              chancellorCandidate: undefined,
              presidentialCandidate: undefined
            };
          } else {
            game = { ...game, phase: 'VOTE_ON_TICKET' };
          }
          game = {
            ...game,
            players: game.players.map(player => {
              return { ...player, vote: undefined };
            })
          };
          broadcastGameState();
        }, 4000);
      }
    }
    broadcastGameState();
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



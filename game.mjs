// @flow

// This is the game state machine. The game state can only be changed through `event` messages.

import { playerSetup, policies } from './rules.mjs';
import { assert, pluckRandom, pluck, shuffle, latestPolicy, playerRight } from './utils.mjs';
/* :: import type { Game, Message, Player, Policy } from './types'; */

export default function update(game /* : Game */, message /* : Message */, now /* : number */) /* : Game */ {
  if (message.type === 'START_GAME') {
    if (canStart(game)) {
      game = startGame(game, now);
    }
  } else if (message.type === 'PLAYER_JOIN') {
    const player = game.players.find(player => player.id === message.body.playerId);
    if (player) {
      // NOOP
    } else {
      // create a player
      // TODO Handle error case for when game has already started.
      if (!game.isStarted) {
        const newPlayer = {
          id: message.body.playerId,
          name: `Player ${game.players.length + 1}`,
          role: undefined,
          revealRole: false,
          seenRole: false,
          vote: undefined,
          killed: false,
          killedAt: undefined,
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
    if (game.phase.name === 'VIEW_ROLES') {
      const unseenPlayers = game.players.filter(player => !player.seenRole);
      if (unseenPlayers.length === 0) {
        // All players have seen their role. move to election phase.
        game = {
          ...game,
          phase: {
            name: 'ELECTION_START',
            timestamp: now
          }
        }
        if (game.presidentCandidate === undefined) {
          game = {
            ...game,
            presidentCandidate: getRandomPlayer(game).id
          };
        }
      }
    }
  } else if (message.type === 'SELECT_CHANCELLOR_CANDIDATE') {
    const { playerId } = message.body;
    game = {
      ...game,
      chancellorCandidate: playerId,
      phase: {
        name: 'VOTE_ON_TICKET',
        timestamp: now
      }
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
    const notVoted = game.players.filter(player => player.vote === undefined && !player.killed);
    if (notVoted.length === 0) {
      game = {
        ...game,
        phase: {
          name: 'REVEAL_TICKET_RESULTS',
          timestamp: now
        }
      };
    }
  } else if (message.type === 'CLOCK_TICK') {
    if (
      game.phase.name === 'REVEAL_TICKET_RESULTS' &&
      (now - game.phase.timestamp > 4000)
    ) {
      const jas = game.players
        .filter(player => !player.killed)
        .reduce((jas /* :  number */, player) => {
          return player.vote === 'ja' ? (jas + 1) : jas;
        }, 0);
      const win = jas > (game.players.filter(player => !player.killed).length / 2);
      if (win) {
        const fascistPolicies = game.policies.filter(policy => policy.location === 'fascist');
        if (game.chancellorCandidate === game.hitler && fascistPolicies.length >= 3) {
          // Fascists Win!
          game  = {
            ...game,
            phase: { name: 'FASCISTS_WIN_WITH_HITLER_CHANCELLOR', timestamp: now },
            electedChancellor: game.chancellorCandidate,
            electedPresident: game.presidentCandidate,
            chancellorCandidate: undefined,
            presidentCandidate: undefined
          };
        } else {
          game = {
            ...game,
            phase: {
              name: 'LEGISLATIVE_SESSION_START',
              timestamp: now
            },
            failedVotes: 0,
            // draw the presidents 3 policies.
            policies: game.policies.reduce((accum, policy) => {
              let newPolicy = policy;
              let found = accum.found;
              if (policy.location === 'deck' && accum.found < 3) {
                found = found + 1;
                newPolicy = {
                  ...policy,
                  location: 'president'
                };
              }
              return { found, policies: [...accum.policies, newPolicy] };
            }, { found: 0, policies: []}).policies,
            electedChancellor: game.chancellorCandidate,
            electedPresident: game.presidentCandidate,
            chancellorCandidate: undefined,
            presidentCandidate: undefined
          };
        }
      } else {
        // Fail. Move the president ticket.
        game = {
          ...game,
          phase: {
            name: 'VOTE_ON_TICKET',
            timestamp: now
          },
          failedVotes: game.failedVotes + 1,
          presidentCandidate: playerRight(
            game.players,
            player => player.id === game.presidentCandidate
          ).id
        };
      }
      game = {
        ...game,
        players: game.players.map(player => {
          return { ...player, vote: undefined };
        })
      };
    } else if (game.phase.name === 'REVEAL_NEW_POLICY' &&
      (now  - game.phase.timestamp > 4000)) {
      // check if we need to shuffle the deck.
      const deck = game.policies.filter(policy => policy.location === 'deck');
      if (deck.length < 3) {
        game = {
          ...game,
          phase: { name: 'SHUFFLE_DECK', timestamp: now }
        };
      } else {
        game = update(game, {
          type: 'DECK_READY',
        }, now);
      }
    } else if (game.phase.name === 'SHUFFLE_DECK' &&
      (now  - game.phase.timestamp > 4000)) {
        game = update({
          ...game,
          policies: shuffle(game.policies.map(policy => {
            if (policy.location === 'discard') {
              return { ...policy, location: 'deck', timestamp: now };
            }
            return policy;
          })),
        }, {
          type: 'DECK_READY',
        }, now);
    } else if (game.phase.name === 'REVEAL_POLICIES' &&
      (now - game.phase.timestamp > 4000)
    ) {
      const policy = latestPolicy(game);
      if (!policy) {
        throw new Error(`Invariant failed. Policy should exist`);
      }
      const fascistPolicies = game.policies.filter(policy => policy.location === 'fascist').length;
      const liberalPolicies = game.policies.filter(policy => policy.location === 'liberal').length;
      if (policy.type === 'liberal') {
        if (liberalPolicies === 5) {
          game = {
            ...game,
            phase: { name: 'LIBERALS_WIN_BY_POLICY', timestamp: now }
          };
        } else {
          game = startNextElection(game, now);
        }
      } else if (policy.type === 'fascist') {
        // a fascist policy was just played.
        if (fascistPolicies === 6) {
          // Fascists win!
          game = {
            ...game,
            phase: { name: 'FASCISTS_WIN_BY_POLICY', timestamp: now }
          };
        } else if (game.players.length <= 6) {
          if (fascistPolicies === 3) {
            game = {
              ...game,
              phase: { name: 'PRESIDENT_EXAMINE_DECK_START', timestamp: now }
            };
          } else if (fascistPolicies === 4 || fascistPolicies === 5) {
            game = {
              ...game,
              phase: { name: 'PRESIDENT_KILL_START', timestamp: now }
            };
          } else {
            game = startNextElection(game, now);
          }
        } else if (game.players.length <= 8) {
          if (fascistPolicies === 2) {
            game = {
              ...game,
              phase: { name: 'PRESIDENT_INVESTIGATE_IDENTITY_START', timestamp: now }
            };
          } else if (fascistPolicies === 3) {
            game = {
              ...game,
              phase: { name: 'SPECIAL_ELECTION_START', timestamp: now }
            };
          } else if (fascistPolicies === 4 || fascistPolicies === 5) {
            game = {
              ...game,
              phase: { name: 'PRESIDENT_KILL_START', timestamp: now }
            };
          } else {
            game = startNextElection(game, now);
          }
        } else if (game.players.length <= 10) {
          if (fascistPolicies === 1 || fascistPolicies === 2) {
            game = {
              ...game,
              phase: { name: 'PRESIDENT_INVESTIGATE_IDENTITY_START', timestamp: now }
            };
          } else if (fascistPolicies === 3) {
            game = {
              ...game,
              phase: { name: 'SPECIAL_ELECTION_START', timestamp: now }
            };
          } else if (fascistPolicies === 4 || fascistPolicies === 5) {
            game = {
              ...game,
              phase: { name: 'PRESIDENT_KILL_START', timestamp: now }
            };
          }
        }
      }
    } else if (
      game.phase.name === 'REVEAL_KILLED_PLAYER' &&
      (now - game.phase.timestamp > 4000)
    ) {
      game = startNextElection(game, now);
    }
  } else if (message.type === 'PRESIDENT_DISCARD_POLICY') {
    const index = game.policies.findIndex(policy => policy.id === message.body.policyId);
    const [discarded, policies] /*: [Policy, $ReadOnlyArray<Policy>] */ = pluck(game.policies, index);
    game = {
      ...game,
      phase: { name: 'CHANCELLOR_POLICY_TURN', timestamp: now },
      policies: [...policies.map((policy /*: Policy */) => {
        if (policy.location === 'president') {
          return { ...policy, location: 'chancellor', timestamp: now };
        }
        return policy;
      }), { ...discarded, location: 'discard', timestamp: now }]
    };
  } else if (message.type === 'CHANCELLOR_DISCARD_POLICY') {
    const index = game.policies.findIndex(policy => policy.id === message.body.policyId);
    const [discarded, policies] = pluck(game.policies, index);
    game = {
      ...game,
      phase: { name: 'REVEAL_NEW_POLICY', timestamp: now },
      policies: [...policies.map((policy /*: Policy */) => {
        if (policy.location === 'chancellor') {
          return {
            ...policy,
            location: policy.type,
            timestamp: now,
          };
        }
        return policy;
      }), { ...discarded, location: 'discard', timestamp: now } ]
    }
  } else if (message.type === 'DECK_READY') {
    game = {
      ...game,
      phase: { name: 'REVEAL_POLICIES', timestamp: now },
    };
  } else if (message.type === 'DONE_EXAMINING_DECK') {
    game = startNextElection(game, now);
  } else if (message.type === 'KILL_PLAYER') {
    game = {
      ...game,
      players: game.players.map(player => {
        if (player.id === message.body.playerId) {
          return { ...player, killed: true, killedAt: now };
        }
        return player;
      })
    };
    const hitler = game.players.find(player => player.id === game.hitler);
    if (hitler && hitler.killed) {
      game = {
        ...game,
        phase: {
          name: 'LIBERALS_WIN_BY_HITLER_ASSASSINATION',
          timestamp: now
        }
      }
    } else {
      game = {
        ...game,
        phase: {
          name: 'REVEAL_KILLED_PLAYER',
          timestamp: now
        }
      };
    }
  }
  return game;
}

function getRandomPlayer(game) {
  const players = game.players.filter(player => !player.killed);
  const randomIndex = Math.floor(Math.random() * players.length);
  return players[randomIndex];
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

function startGame(game /*: Game */, now /* : number */)/*: Game */ {
  const oldPlayers = game.players;
  let [hitler, unmatchedPlayers] = pluckRandom(game.players);
  hitler = { ...hitler, role: 'fascist' };
  let matchedPlayers /* : $ReadOnlyArray<Player> */ = [hitler];
  let player;
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
    phase: { name: 'VIEW_ROLES', timestamp: now },
    players: matchedPlayers,
    presidentCandidate: getRandomPlayer(game).id,
    hitler: hitler.id,
  };
}

function startNextElection(game /*: Game */, now /*: number */) /*: Game */ {
  return {
    ...game,
    phase: { name: 'ELECTION_START', timestamp: now },
    presidentCandidate: playerRight(
      game.players.filter(player => !player.killed),
      player => player.id === game.electedPresident
    ).id
    // presidentCandidate
  };
}

const canStart = (game) => game && game.isStarted === false && game.players.length >= 5;
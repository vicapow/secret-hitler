// @flow

/* :: import type { Game, Policy, Player } from './types.mjs'; */

export function assert(condition /* : boolean | void */) {
  if (!condition) {
    throw new Error(`Assertion failure.`);
  }
}

export function randomIndex /* :: <T> */ (array /*: $ReadOnlyArray<T> */) /*: number */ {
  return Math.floor(Math.random() * array.length);
}

export function pluck /* :: <T> */(array /*: $ReadOnlyArray<T> */, index /*: number */) /* : [T, $ReadOnlyArray<T>] */ {
  const resultArray = [...array.slice(0, index), ...array.slice(index + 1) ];
  return [array[index], resultArray];
}

export function pluckRandom /* :: <T> */(array /*: $ReadOnlyArray<T> */) /* : [T, $ReadOnlyArray<T>] */ {
  const index = randomIndex(array);
  return pluck(array, index);
}

export function shuffle /* :: <T> */(array /*: $ReadOnlyArray<T> */) /* : $ReadOnlyArray<T> */ {
  let newArray/*: $ReadOnlyArray<T> */ = [];
  let rest /*: $ReadOnlyArray<T> */ = array;
  let item /*: T | void */;
  while (rest.length) {
    [item, rest] = pluckRandom(rest); // pluck
    newArray = [...newArray, item]; // push
  }
  return newArray;
}

export function latestPolicy(game /*: Game */) /*: Policy | void */ {
  return game.policies.reduce((latest, policy) => {
    if (policy.location !== 'fascist' && policy.location !== 'liberal') {
      return latest;
    }
    if (!latest || policy.timestamp > latest.timestamp) {
      return policy;
    }
    return latest;
  }, undefined);
}

export function isOver(game /*: Game */) /*: boolean */ {
  return fascistsWon(game) || liberalsWon(game);
}

export function fascistsWon(game /*: Game */) /*: boolean */ {
  return [
    'FASCISTS_WIN_WITH_HITLER_CHANCELLOR',
    'FASCISTS_WIN_BY_POLICY',
  ].indexOf(game.phase.name) !== -1;
}

export function liberalsWon(game /*: Game */) /*: boolean */ {
  return [
    'LIBERALS_WIN_BY_POLICY',
    'LIBERALS_WIN_BY_HITLER_ASSASSINATION',
  ].indexOf(game.phase.name) !== -1;
}

export function playerRight(players /*: $ReadOnlyArray<Player> */, match /*: (Player) => boolean */) /*: Player */ {
  const index = players.findIndex(match);
  const lastIndex = players.length - 1;
  if (index + 1 <= lastIndex) {
    return players[index + 1];
  }
  // wrap around
  return players[0];
}
// @flow

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
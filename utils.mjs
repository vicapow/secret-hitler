// @flow

export function assert(condition /* : boolean | void */) {
  if (!condition) {
    throw new Error(`Assertion failure.`);
  }
}

export function pluckRandom /* :: <T> */(array /*: $ReadOnlyArray<T> */) /* : [T, $ReadOnlyArray<T>] */ {
  const randomIndex = Math.floor(Math.random() * array.length);
  const resultArray = [...array.slice(0, randomIndex), ...array.slice(randomIndex + 1) ];
  return [array[randomIndex], resultArray];
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
// @flow

/*::

export type Player = $ReadOnly<{|
  id: string,
  name: string,
  revealRole: boolean,
  seenRole: boolean,
  role: 'fascist' | 'liberal' | void,
  vote: 'ja' | 'nein' | void,
|}>;

export type Policy = $ReadOnly<{|
  id: string,
  type: 'fascist' | 'liberal',
  location: 'deck' | 'president' | 'chancellor' | 'enacted'
|}>;

export type Game = $ReadOnly<{|
  isStarted: boolean,
  isVoting: boolean,
  players: $ReadOnlyArray<Player>,
  policies: $ReadOnlyArray<Policy>,
  hitler: string | void,
  phase: Phase | void,
  presidentialCandidate: string | void,
  chancellorCandidate: string | void,
  electedPresident: string | void,
  electedChancellor: string | void,
|}>;

// Round phases
export type Phase =
  | 'VIEW_ROLES'
  | 'SELECT_CHANCELLOR_CANDIDATE'
  | 'ELECTION_START'
  | 'VOTE_ON_TICKET'
  | 'REVEAL_TICKET_RESULTS'
  | 'TICKET_FAIL'
  | 'LEGISLATIVE_SESSION_START'
  | 'EXECUTION_ACTION_PHASE';

export type Message =
  | {| type: 'UPDATE_PLAYER_NAME', body: {| name: string, playerId: string |} |}
  | {| type: 'START_GAME' |}
  | {| type: 'PLAYER_JOINED', body: {| player: Player |} |}
  | {| type: 'PLAYER_JOIN', body: {| playerId: string |} |}
  | {| type: 'REVEAL_ROLE', body: {| playerId: string |} |}
  | {| type: 'UPDATE_GAME_STATE', body: {| game: Game |} |}
  | {| type: 'SELECT_CHANCELLOR_CANDIDATE', body: {| playerId: string |} |}
  | {| type: 'VOTE_ON_TICKET', body: {| playerId: string, vote: 'ja' | 'nein' |} |}

*/
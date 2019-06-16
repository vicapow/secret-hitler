// @flow

/*::

export type Player = {|
  id: string,
  name: string,
  revealRole: boolean,
  seenRole: boolean,
  role: 'fascist' | 'liberal' | void,
  vote: 'ja' | 'nein' | void
|}

export type Game = {|
  isStarted: boolean,
  isVoting: boolean,
  players: Array<Player>,
  hitler: string | void,
  phase: Phase | void,
  presidentialCandidate: string | void,
  chancellorCandidate: string | void,
  electedPresident: string | void,
  electedChancellor: string | void,
|};

// Round phases
export type Phase =
  | 'ELECTION_START'
  | 'SELECT_CHANCELLOR_CANDIDATE'
  | 'VOTE_ON_TICKET'
  | 'REVEAL_TICKET_RESULTS'
  | 'TICKET_FAIL'
  | 'TICKET_SUCCESS'
  | 'LEGISLATIVE_SESSION_START'
  | 'EXECUTION_ACTION_PHASE';

export type Message =
  | {| type: 'UPDATE_PLAYER_NAME', body: {| name: string, playerId: string |} |}
  | {| type: 'START_GAME' |}
  | {| type: 'PLAYER_JOINED', body: {| player: Player |} |}
  | {| type: 'PLAYER_JOIN', body: {| playerId: string |} |}
  | {| type: 'REVEAL_ROLE', body: {| playerId: string |} |}
  | {| type: 'UPDATE_GAME_STATE', body: {| game: Game |} |}

*/
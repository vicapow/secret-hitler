// @flow

/*::

export type Player = $ReadOnly<{|
  id: string,
  name: string,
  revealRole: boolean,
  seenRole: boolean,
  role: 'fascist' | 'liberal' | void,
  vote: 'ja' | 'nein' | void,
  killed: boolean | void,
  killedAt: number | void,
|}>;

export type Policy = $ReadOnly<{|
  id: string,
  type: 'fascist' | 'liberal',
  location: 'deck' | 'president' | 'chancellor' | 'fascist' | 'liberal' | 'discard',
  timestamp: number,
|}>;

export type Game = $ReadOnly<{|
  isStarted: boolean,
  isVoting: boolean,
  failedVotes: number,
  players: $ReadOnlyArray<Player>,
  policies: $ReadOnlyArray<Policy>,
  hitler: string | void,
  phase: $ReadOnly<{|
    name: Phase | void,
    timestamp: number
  |}>,
  presidentCandidate: string | void,
  chancellorCandidate: string | void,
  electedPresident: string | void,
  electedChancellor: string | void,
|}>;

// Round phases
export type Phase =
  | 'VIEW_ROLES'
  | 'ELECTION_START'
  | 'VOTE_ON_TICKET'
  | 'REVEAL_TICKET_RESULTS'
  | 'TICKET_FAIL'
  | 'LEGISLATIVE_SESSION_START'
  | 'CHANCELLOR_POLICY_TURN'
  | 'REVEAL_NEW_POLICY'
  | 'SHUFFLE_DECK'
  | 'REVEAL_POLICIES'
  | 'EXECUTIVE_ACTION_INVESTIGATE_LOYALTY'
  | 'PRESIDENT_EXAMINE_DECK_START'
  | 'PRESIDENT_KILL_START'
  | 'PRESIDENT_INVESTIGATE_IDENTITY_START'
  | 'SPECIAL_ELECTION_START'
  | 'FASCISTS_WIN_WITH_HITLER_CHANCELLOR'
  | 'FASCISTS_WIN_BY_POLICY'
  | 'LIBERALS_WIN_BY_POLICY'
  | 'LIBERALS_WIN_BY_HITLER_ASSASSINATION'
  | 'REVEAL_KILLED_PLAYER'

export type Message =
  | $ReadOnly<{| type: 'UPDATE_PLAYER_NAME', body: $ReadOnly<{| name: string, playerId: string |}> |}>
  | $ReadOnly<{| type: 'START_GAME' |}>
  | $ReadOnly<{| type: 'CLOCK_TICK' |}>
  | $ReadOnly<{| type: 'PLAYER_JOINED', body: $ReadOnly<{| player: Player |}> |}>
  | $ReadOnly<{| type: 'PLAYER_JOIN', body: {| playerId: string |} |}>
  | $ReadOnly<{| type: 'REVEAL_ROLE', body: {| playerId: string |} |}>
  | $ReadOnly<{| type: 'UPDATE_GAME_STATE', body: {| game: Game |} |}>
  | $ReadOnly<{| type: 'SELECT_CHANCELLOR_CANDIDATE', body: $ReadOnly<{| playerId: string |}> |}>
  | $ReadOnly<{| type: 'VOTE_ON_TICKET', body: $ReadOnly<{| playerId: string, vote: 'ja' | 'nein' |}> |}>
  | $ReadOnly<{| type: 'PRESIDENT_DISCARD_POLICY', body: $ReadOnly<{| policyId: string |}> |}>
  | $ReadOnly<{| type: 'CHANCELLOR_DISCARD_POLICY', body: $ReadOnly<{| policyId: string |}> |}>
  | $ReadOnly<{| type: 'DECK_READY' |}>
  | $ReadOnly<{| type: 'DONE_EXAMINING_DECK' |}>
  | $ReadOnly<{| type: 'KILL_PLAYER', body: $ReadOnly<{| playerId: string |}> |}>

*/
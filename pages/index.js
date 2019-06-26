// @flow

import * as React from 'react';
import io from 'socket.io-client';
import type { Message, Game } from '../types.mjs';
import { assert, latestPolicy, isOver, fascistsWon } from '../utils.mjs';

type State = $ReadOnly<{|
  isHand: boolean,
  isDebug: boolean,
  playerId: string | void,
  game: Game | void
|}>;

export default class Home extends React.Component<{||}, State> {
  constructor() {
    super();
    this.socket = null;
    this.state = {
      isHand: true,
      isDebug: false,
      playerId: undefined,
      game: undefined
    };
  }

  socket: any;

  sendMessage(message: Message) {
    console.log(message);
    this.socket.emit('message', message);
  }

  componentDidMount() {
    // Get or create a playerId.
    const urlParams = new URLSearchParams(window.location.search);
    const isHand = urlParams.get('isHand') === 'true' || checkIsMobile();
    const isDebug = urlParams.get('debug') !== null;
    const playerId /*: string | void */ = isHand && (urlParams.get('playerId') || window.localStorage.getItem('playerId') || String(Math.random())) || undefined;
    this.socket = io();
    if (isHand) {
      window.localStorage.setItem('playerId', playerId);
    }
    this.setState({
      isHand,
      isDebug,
      playerId,
      game: undefined
    });
    this.socket.on('fail', failMessage => {
      throw new Error(failMessage);
    });
    this.socket.on('message', this.onMessage);
  }

  onStart = () => {
    this.sendMessage({type: 'START_GAME'});
  }

  onRevealRole = () => {
    if (this.state.playerId) {
      this.sendMessage({ type: 'REVEAL_ROLE', body: { playerId: this.state.playerId } });
    }
  }

  onMessage = (message: Message) => {
    let player;
    let { game, isHand, playerId } = this.state;
    if (message.type === 'UPDATE_GAME_STATE') {
      game = message.body.game;
      if (this.state.playerId) {
        player = game && getPlayer(this.state.playerId, game) || undefined;
        if (!player && isHand && !game.isStarted && typeof playerId === 'string') {
          this.sendMessage({
            type: 'PLAYER_JOIN',
            body: { playerId }
          });
        }
      }
    }
    this.setState({ game });
  }

  onUpdateName = (e: SyntheticKeyboardEvent<HTMLInputElement>) => {
    const name = e.currentTarget.value;
    if (this.state.playerId) {
      this.sendMessage({ type: 'UPDATE_PLAYER_NAME', body: { name, playerId: this.state.playerId } });
    }
  }

  onSelectChancellorCandidate = (playerId: string) => {
    this.sendMessage({
      type: 'SELECT_CHANCELLOR_CANDIDATE',
      body: { playerId }
    })
  }

  voteOnTicket = (playerId: string, vote: 'ja' | 'nein') => {
    this.sendMessage({
      type: 'VOTE_ON_TICKET',
      body: {playerId, vote }
    });
  }

  presidentDiscardPolicy = (policyId: string) => {
    this.sendMessage({
      type: 'PRESIDENT_DISCARD_POLICY',
      body: { policyId }
    });
  }

  chancellorDiscardPolicy = (policyId: string) => {
    this.sendMessage({
      type: 'CHANCELLOR_DISCARD_POLICY',
      body: { policyId }
    });
  }

  doneExaminingDeck = () => {
    this.sendMessage({ type: 'DONE_EXAMINING_DECK' });
  }

  killPlayer  = (playerId: string) => {
    this.sendMessage({ type: 'KILL_PLAYER', body: { playerId } });
  }

  render() {
    if (this.state.isHand) {
      return <Hand
        state={this.state}
        onStart={this.onStart}
        onRevealRole={this.onRevealRole}
        onUpdateName={this.onUpdateName}
        onSelectChancellorCandidate={this.onSelectChancellorCandidate}
        voteOnTicket={this.voteOnTicket}
        presidentDiscardPolicy={this.presidentDiscardPolicy}
        chancellorDiscardPolicy={this.chancellorDiscardPolicy}
        doneExaminingDeck={this.doneExaminingDeck}
        killPlayer={this.killPlayer}
        />;
    }
    return <Board state={this.state} />;
  }
}

function HandButton(props) {
  return <button onClick={props.onClick}
    style={{
    width: '100%',
    background: '#434343',
    padding: 10,
    marginBottom: 10,
    color: 'white',
    border: 'none'
    }}
  >{props.children}</button>;
}

function Hand({
  state,
  onStart,
  onRevealRole,
  onUpdateName,
  onSelectChancellorCandidate,
  voteOnTicket,
  presidentDiscardPolicy,
  chancellorDiscardPolicy,
  doneExaminingDeck,
  killPlayer,
}: {|
  state: State,
  onStart: () => void,
  onRevealRole: () => void,
  onUpdateName: (SyntheticKeyboardEvent<HTMLInputElement>) => void,
  onSelectChancellorCandidate: (playerId: string) => void,
  voteOnTicket: (playerId: string, vote: 'ja' | 'nein') => void,
  presidentDiscardPolicy: (policyId: string) => void,
  chancellorDiscardPolicy: (policyId: string) => void,
  doneExaminingDeck: () => void,
  killPlayer: (playerId: string) => void,
|}) {
  const { playerId, game } = state;
  const player = playerId && game && getPlayer(playerId, game) || undefined;
  if (!player || !game || !playerId) {
    return <div></div>;
  }
  const role = player.role;
  if (player.killed) {
    return  <div style={{ fontFamily: 'Futura', margin: 14, fontSize: 24 }}>
      <h1> You're dead </h1>
      <p> Please wait quietly until the end of the game. Definitely not reveal your identity or give any hits! </p>
    </div>;
  }
  const presidentCandidate = getPlayer(game.presidentCandidate || '', game);
  const chancellorCandidate = getPlayer(game.chancellorCandidate || '', game);
  return <div style={{ fontFamily: 'Futura', margin: 14, fontSize: 24 }}>
      <style global jsx>{`
      body {
        margin: 0;
      }
    `}</style>
    {!game.isStarted && canStart({game})
      ? <HandButton onClick={onStart}>Start the game?</HandButton> : null}
    {!game.isStarted && !canStart({game}) ? <div style={{}}>
      <div>{canStartMessage({game})}</div>
    </div> : null}
    <div>
      <span>name: </span>
      <input type="text" onChange={onUpdateName} value={player.name} style={{
        fontSize: 24,
        border: 'gray',
        borderStyle: 'dotted',
      }} />
    </div>
    { role !== undefined ? <div>
      <HandButton onClick={onRevealRole}>Reveal role</HandButton>
      { player.revealRole ? <div>
        <span>{getRoleMessage(player, game)}</span>
        <img style={{width: '100%'}} src={player.id === game.hitler ? 'static/hitler.png' : `static/${role}.png`} />
      </div> : null}
    </div> : null }
    { game.phase.name === 'ELECTION_START' && player.id === game.presidentCandidate ? <div>
      You're the presidential candidate. Pick your chancellor candidate.
      <div style={{marginTop: 10}}>
        {game.players
          .filter(player => {
            if (player.killed) {
              return false;
            }
            if (player.id === playerId) {
              return false;
            }
            if (player.id === game.electedChancellor) {
              // chancellors are always term limited.
              return false;
            }
            if (game.players.filter(player => !player.killed).length > 5 && player.id === game.electedPresident) {
              // presidents are not term limited when there are 5 or fewer players.
              return false;
            }
            return true;
          }).map(player => {
          return <div style={{}}><HandButton onClick={() => onSelectChancellorCandidate(player.id)}>{player.name}</HandButton></div>
        })}
      </div>
    </div> : null}
    { game.phase.name === 'VOTE_ON_TICKET' ? <div>
      <h1>Vote on ticket</h1>
      <div>President: {presidentCandidate ? presidentCandidate.name : ''} </div>
      <div>Chancellor: {chancellorCandidate ? chancellorCandidate.name : ''} </div>
      { player.vote === undefined ? <div>
        <HandButton onClick={() => voteOnTicket(playerId, 'ja')}>Ja</HandButton>
        <HandButton onClick={() => voteOnTicket(playerId, 'nein')}>Nien</HandButton>
      </div> : <div>
        <h1>voted {player.vote}</h1>
      </div>}
      <div style={{textAlign: 'center'}}>
        Waiting on {game.players.filter(player => player.vote === undefined).length} player(s)
      </div>
    </div> : null}
    { game.phase.name === 'LEGISLATIVE_SESSION_START' && game.electedPresident === playerId ? <div>
      <h1> Pick which policy to discard </h1>
      <div style={{display: 'flex', flexDirection: 'row'}}>
      { game.policies.filter(policy => policy.location === 'president').map(policy => {
        return <div style={{ flexGrow: 1}} onClick={() => presidentDiscardPolicy(policy.id)}>
          <img src={`static/${policy.type}-policy.png`} style={{width: '100%'}} />
        </div>
      })}
      </div>
    </div> : null}
    { game.phase.name === 'CHANCELLOR_POLICY_TURN' && game.electedChancellor === playerId ? (() => {
      const [policy1, policy2] = game.policies.filter(policy => policy.location === 'chancellor');
      return <div>
        <h1> Pick which policy to enact </h1>
        <div style={{display: 'flex', flexDirection: 'row'}}>
        <div style={{ flexGrow: 1}} onClick={() => chancellorDiscardPolicy(policy2.id)}>
          <img src={`static/${policy1.type}-policy.png`} style={{width: '100%'}} />
        </div>
        <div style={{ flexGrow: 1}} onClick={() => chancellorDiscardPolicy(policy1.id)}>
          <img src={`static/${policy2.type}-policy.png`} style={{width: '100%'}} />
        </div>
        </div>
      </div>
    })() : null }
    { game.phase.name === 'PRESIDENT_EXAMINE_DECK_START' && game.electedPresident === playerId ? <div>
      <h1> Review the top three cards in the deck</h1>
      <div style={{display: 'flex', flexDirection: 'row'}}>
        { game.policies.filter(policy => policy.location === 'deck').slice(0, 3).map(policy => {
          return <div style={{ flexGrow: 1}}s>
            <img src={`static/${policy.type}-policy.png`} style={{width: '100%'}} />
          </div>
        })}
      </div>
      <HandButton onClick={() => doneExaminingDeck() }>finish</HandButton>
    </div> : null }
    { game.phase.name === 'PRESIDENT_KILL_START' && game.electedPresident === playerId ? <div>
      <h1>Pick a player to kill</h1>
      <div>
        <div>
          { game.players.filter(player => player.id !== playerId && !player.killed).map(player => {
            return <HandButton onClick={() => killPlayer(player.id) }>{player.name}</HandButton>
          })}
        </div>
      </div>
    </div> : null }
    {state.isDebug ? `playerId ${playerId}` : null}
    {state.isDebug ? <pre>{JSON.stringify(state, null, 2)}</pre> : null}
  </div>;
}

const SecretHitlerLogo = () => <div style={{width: '100%', height: '100%', position: 'relative'}}>
  <img style={{
    width: '100%',
    height: '100%',
    objectFit: 'contain'
  }} src="static/secret-hitler-logo-wide.png" />
  <div style={{position: 'relative', left: 0, top: '-50%', width: '100%', height: 1}}>
    <span style={{position: 'absolute', right: 8, width: '100%', textAlign: 'right', top: 210 }}>2016–2019 GOAT, WOLF, & CABBAGE ˙ CC SA–BY–NC 4.0 ˙ SECRETHITLERGAME@GMAIL.COM</span>
  </div>
</div>;

function Board({state}: {| state: State |}) {
  const { game } = state;
  if (!game) {
    return <SecretHitlerLogo />;
  }
  if (isOver(game)) {
    return (
      <BoarderContainer
        state={state}
        renderContent={({width, height}: { width: number, height: number}) => {
          return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
            <div style={{flexGrow: 1}}></div>
            <div style={{flexGrow: 1, textAlign: 'center'}}>
              <h1>{fascistsWon(game) ? `Fascists` : `Liberals`} Won!</h1>
            </div>
            <div style={{flexGrow: 1}}></div>
          </div>;
        }}
      />
    )
  }
  if (game.phase.name === 'VIEW_ROLES') {
    return (
      <BoarderContainer state={state} renderContent={({width, height}: { width: number, height: number}) => {
        return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}></div>
          <div style={{flexGrow: 1, textAlign: 'center'}}>
            <h1>Everyone view your role!</h1>
            <div>
              {game.players.map(player => {
                return <div>
                  <h2>{`${player.seenRole ? '🤭' : '🙈'} ${player.name}`}</h2>
                </div>;
              })}
            </div>
          </div>
          <div style={{flexGrow: 1}}></div>
        </div>;
      }} />
    );
  }
  if (game.phase.name === 'ELECTION_START') {
    const presidentCandidate = game.players.find(player => player.id === game.presidentCandidate);
    if (!presidentCandidate) {
      throw new Error(`No presidential candidate`);
    }
    return (
      <BoarderContainer state={state} renderContent={({width, height}: { width: number, height: number}) => {
        return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}></div>
          <div style={{flexGrow: 1, textAlign: 'center'}}>
            <h1 style={{fontSize: 100}}> Election </h1>
            <h2>President candidate {presidentCandidate.name}, please select your chancellor candidate.</h2>
          </div>
        </div>;
      }} />
    );
  }
  if (game.phase.name === 'VOTE_ON_TICKET') {
    const presidentCandidate = getPlayer(game.presidentCandidate || '', game);
    const chancellorCandidate = getPlayer(game.chancellorCandidate || '', game);
    return (
      <BoarderContainer state={state} renderContent={({width, height}: { width: number, height: number}) => {
        return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}></div>
          <div style={{flexGrow: 1, textAlign: 'center'}}>
            <h1 style={{fontSize: 100}}> Vote on ticket </h1>
            <h2> President Candidate ----- {presidentCandidate ? presidentCandidate.name : ''} </h2>
            <h2> Chancellor Candidate ----- {chancellorCandidate ? chancellorCandidate.name : ''} </h2>
            <div>
              {game.players.map(player => {
                return <div>{player.name} {player.vote !== undefined ? '🗳️' : ``}</div>
              })}
            </div>
          </div>
          <div style={{flexGrow: 1}}></div>
        </div>;
      }} />
    )
  }
  if (game.phase.name === 'REVEAL_TICKET_RESULTS') {
    const jas = game.players.reduce((jas:  number, player) => {
      return player.vote === 'ja' ? jas + 1 : jas;
    }, 0);
    const win = jas > (game.players.filter(player => !player.killed).length / 2);
    return (
      <BoarderContainer state={state} renderContent={() => {
        return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}></div>
          <div style={{flexGrow: 1, textAlign: 'center'}}>
            <h1 style={{fontSize: 100}}> { win ? 'Success' : 'Failure' }</h1>
            <div style={{display: 'flex', flexDirection: 'row', width: '100%', height: '100%'}}>
              <div style={{flexGrow: 1}}></div>
              <div style={{textAlign: 'left'}}>
                {game.players.filter(player => !player.killed).map(player => {
                  const { vote } = player;
                  return <div style={{fontSize: 20}}>
                    { vote ? <img style={{verticalAlign: 'middle', width: 80}} src={`static/${vote}.png`} /> : null }
                    {player.name}
                  </div>
                })}
              </div>
              <div style={{flexGrow: 1}}></div>
            </div>
          </div>
          <div style={{flexGrow: 1}}></div>
        </div>
      }} />
    );
  }
  if (game.phase.name === 'LEGISLATIVE_SESSION_START' || game.phase.name === 'CHANCELLOR_POLICY_TURN') {
    const chancellor = getPlayer(game.electedChancellor || '', game);
    const president = getPlayer(game.electedPresident || '', game);
    if (!chancellor || !president) {
      throw new Error(`Chancellor or president is not set`);
    }
    return (
      <BoarderContainer state={state} renderContent={({width, height}: { width: number, height: number})=> {
        return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}>
            <div style={{display: 'flex', flexDirection: 'row', height: '100%' }}>
              <div style={{flexGrow: 4}}></div>
              <div style={{flexGrow: 2, textAlign: 'center'}}>
                <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
                  <div style={{flexGrow: 1}}>
                    <h2>{president.name}</h2>
                  </div>
                  <div style={{flexGrow: 1}}>
                    <img src="static/president.png" style={{ height: 100}} />
                  </div>
                  <div style={{flexGrow: 1}}>
                   {game.phase.name === 'LEGISLATIVE_SESSION_START' ? <div>
                      <img src="static/policy.png" style={{ height: 80}} />
                      <img src="static/policy.png" style={{ height: 80}} />
                      <img src="static/policy.png" style={{ height: 80}} />
                    </div>
                   : null}
                  </div>
                </div>
              </div>
              <div style={{flexGrow: 2, textAlign: 'center'}}>
                <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
                  <div style={{flexGrow: 1}}>
                    <h2>{chancellor.name}</h2>
                  </div>
                  <div style={{flexGrow: 1}}>
                    <img src="static/chancellor.png" style={{ height: 100}} />
                  </div>
                  <div style={{flexGrow: 1}}>
                   {game.phase.name === 'CHANCELLOR_POLICY_TURN' ? <div>
                      <img src="static/policy.png" style={{ height: 80}} />
                      <img src="static/policy.png" style={{ height: 80}} />
                    </div>
                   : null}
                  </div>
                </div>
              </div>
              <div style={{flexGrow: 4}}></div>
            </div>
          </div>
          <div style={{flexGrow: 1}}>
            <div style={{ display: 'table', width: '100%', height: '100%' }}>
              <div style={{display: 'table-cell', verticalAlign: 'middle', paddingLeft: 200, paddingRight: 200, textAlign: 'center' }}>
                <h1 style={{fontSize: 50}}>The legislative session has started. </h1>
              </div>
            </div>
          </div>
          <div style={{flexGrow: 1}}></div>
        </div>
      }}>
      </BoarderContainer>
    );
  }
  if (game.phase.name === 'REVEAL_NEW_POLICY') {
    const policy = latestPolicy(game);
    if (!policy) {
      throw new Error(`Policy not set`);
    }
    return (
      <BoarderContainer state={state} renderContent={({width, height}: { width: number, height: number})=> {
        return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}></div>
          <div style={{flexGrow: 1, textAlign: 'center'}}>
            <h1> Reveal new policy! </h1>
            <img src={`static/${policy.type}-policy.png`} />
          </div>
          <div style={{flexGrow: 1}}></div>
        </div>;
      }} />
    );
  }
  if (game.phase.name === 'SHUFFLE_DECK') {
    return (
      <BoarderContainer state={state} renderContent={({width, height}: { width: number, height: number})=> {
        return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}></div>
          <div style={{flexGrow: 1, textAlign: 'center'}}>
            <h1> Shuffling deck... </h1>
          </div>
          <div style={{flexGrow: 1}}></div>
        </div>;
      }} />
    );
  }
  if (game.phase.name === 'REVEAL_POLICIES') {
    const liberalPolicies = game.policies.filter(policy => policy.location === 'liberal');
    const fascistPolicies = game.policies.filter(policy => policy.location === 'fascist');
    return (
      <BoarderContainer state={state} renderContent={({width, height}: { width: number, height: number})=> {
        return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}></div>
          <div style={{flexGrow: 1, textAlign: 'center'}}>
            <h1> Reveal policies </h1>
            <div style={{display: 'flex', flexDirection: 'row', height: '100%'}}>
              <div style={{flexGrow: 1, width: '60%'}}></div>
              <div style={{flexGrow: 1, width: '100%'}}>
                <div style={{position: 'relative'}}>
                  <img src="static/liberal-board.png" style={{width: '100%'}} />
                  { liberalPolicies.length >= 1 ?
                    <img src="static/liberal-policy.png" style={{position: 'absolute', left: '16.5%', top: '24%', width: '13%' }}/> : null }
                  { liberalPolicies.length >= 2 ?
                    <img src="static/liberal-policy.png" style={{position: 'absolute', left: '30.1%', top: '24%', width: '13%' }}/> : null }
                  { liberalPolicies.length >= 3 ?
                    <img src="static/liberal-policy.png" style={{position: 'absolute', left: '43.8%', top: '24%', width: '13%' }}/> : null }
                  { liberalPolicies.length >= 4 ?
                    <img src="static/liberal-policy.png" style={{position: 'absolute', left: '57.2%', top: '24%', width: '13%' }}/> : null }
                  { liberalPolicies.length >= 5 ?
                    <img src="static/liberal-policy.png" style={{position: 'absolute', left: '70.9%', top: '24%', width: '13%' }}/> : null }
                </div>
                <div style={{position: 'relative'}}>
                  <img src="static/fascist-board-56.png" style={{width: '100%'}} />
                  { fascistPolicies.length >= 1 ?
                    <img src="static/fascist-policy.png" style={{position: 'absolute', left: '9.5%', top: '24%', width: '13%' }}/> : null }
                  { fascistPolicies.length >= 2 ?
                    <img src="static/fascist-policy.png" style={{position: 'absolute', left: '23.1%', top: '24%', width: '13%' }}/> : null }
                  { fascistPolicies.length >= 3 ?
                    <img src="static/fascist-policy.png" style={{position: 'absolute', left: '36.8%', top: '24%', width: '13%' }}/> : null }
                  { fascistPolicies.length >= 4 ?
                    <img src="static/fascist-policy.png" style={{position: 'absolute', left: '50.2%', top: '24%', width: '13%' }}/> : null }
                  { fascistPolicies.length >= 5 ?
                    <img src="static/fascist-policy.png" style={{position: 'absolute', left: '63.9%', top: '24%', width: '13%' }}/> : null }
                  { fascistPolicies.length >= 6 ?
                    <img src="static/fascist-policy.png" style={{position: 'absolute', left: '77.9%', top: '24%', width: '13%' }}/> : null }
                </div>
              </div>
              <div style={{flexGrow: 1, width: '60%'}}></div>
            </div>
          </div>
          <div style={{flexGrow: 1}}></div>
        </div>;
      }} />
    );
  }
  if (game.phase.name === 'PRESIDENT_EXAMINE_DECK_START') {
    return (
      <BoarderContainer state={state} renderContent={({width, height}: { width: number, height: number})=> {
        return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}>
            <div style={{ display: 'table', width: '100%', height: '100%' }}>
              <div style={{display: 'table-cell', verticalAlign: 'middle', paddingLeft: 200, paddingRight: 200, textAlign: 'center' }}>
                <h1 style={{fontSize: 50}}>President is examining the top 3 cards of the deck...</h1>
              </div>
            </div>
          </div>
        </div>;
      }} />
    );
  }
  if (game.phase.name === 'PRESIDENT_KILL_START') {
    const president = getPlayer(game.electedPresident || '', game);
    if (!president) {
      throw new Error('invariant failed');
    }
    return (
      <BoarderContainer state={state} renderContent={({width, height}: { width: number, height: number})=> {
        return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}>
            <div style={{ display: 'table', width: '100%', height: '100%' }}>
              <div style={{display: 'table-cell', verticalAlign: 'middle', paddingLeft: 200, paddingRight: 200, textAlign: 'center' }}>
                <h1 style={{fontSize: 50}}>The President {president.name} is considering who to kill...</h1>
              </div>
            </div>
          </div>
        </div>;
      }} />
    );
  }

  if (game.phase.name === 'REVEAL_KILLED_PLAYER') {
    const mostRecentlyKilled = game.players.reduce((accum, player) => {
      const { killedAt } = player;
      if (killedAt === undefined) {
        return accum;
      }
      if (accum === undefined || accum.killedAt === undefined || killedAt > accum.killedAt) {
        return player;
      }
      return accum;
    }, undefined);
    if (!mostRecentlyKilled) {
      throw new Error('invariant failed');
    }
    return <BoarderContainer state={state} renderContent={({width, height}: { width: number, height: number})=> {
      return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
        <div style={{flexGrow: 1}}>
          <div style={{ display: 'table', width: '100%', height: '100%' }}>
            <div style={{display: 'table-cell', verticalAlign: 'middle', paddingLeft: 200, paddingRight: 200, textAlign: 'center' }}>
              <h1 style={{fontSize: 50}}>{mostRecentlyKilled.name} was killed!</h1>
            </div>
          </div>
        </div>
      </div>;
    }} />;
  }
  return <BoarderContainer state={state} renderContent={() => {
    return <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
      <div style={{flexGrow: 1}}><SecretHitlerLogo /></div>
      <div style={{flexGrow: 2, textAlign: 'center', fontSize: 50, fontWeight: 'bold'}}>
        { canJoin(state) ?
          <div>{canStartMessage(state)}</div>
        : <div> We're full! Someone start the game.</div> }
      </div>
      <div style={{flexGrow: 4}}>
        <div style={{display: 'flex', flexDirection: 'row'}}>
          <div style={{flexGrow: 3}}></div>
          <div style={{flexGrow: 1, fontSize: 50}}>
            <div>
              { game.players.map(player => {
                return <div>
                  <Bird />
                  <span> </span>
                  {player.name}
                </div>;
              })}
            </div>
          </div>
          <div style={{flexGrow: 3}}></div>
        </div>
      </div>
    </div>
  }} />;
}

const Bird = () => {
  return <svg height="39.2" width="43.2" viewBox="0 0 21.6 19.6" style={{transform: `rotate(-90deg)`}}>
    <path d="M21.4,18.6l-0.4-1c0-0.1,0-0.1,0-0.2l-2.1-4.7l0,0l-0.3-0.6l-0.6-1.2c-0.2-0.5-0.5-0.9-0.9-1.2l0,0l-4-2.5 c0-0.2,0-0.4-0.1-0.6l3.7-1.3L18,4.5l3.1-4l-0.3-0.5l-4.2,2.5l-0.8,0.2l-2.6,0.6c0.2-0.4,0.4-0.8,0.6-1.2c0-0.9-0.7-1.6-1.6-1.5 c0,0,0,0,0,0c-0.2,0-0.4,0-0.6,0.1l0,0l-2,0.3l1,0.8L8.4,2.2C7.3,2.4,6.4,3.3,6,4.4L5.4,6.6l0,0C5.3,6.8,5.2,7.1,5.2,7.4l-2,0.2 c-0.1,0-0.2,0-0.4,0c0,0,0,0-0.1,0.1l-1,0.1l-1.8,2.2v1.6h0.2c0,0.2,0,0.3,0.2,0.4l1-0.1l-1,0.6C0.1,12.7,0,12.9,0,13.2l0,0l0.3,1.2 c0,0.1,0,0.3,0.1,0.4l0,0h0.1c0,0,0.1,0,0.1,0l1.4,0.4L2,14.9c0.1-0.1,0.3-0.1,0.4-0.2L6,11.1l2-1.9l0.7,1.5 c0.1,0.3,0.3,0.5,0.6,0.5l0.3,0.3L10,12c0.1,0.3,0.5,0.5,0.9,0.4c0,0,0.1,0,0.1-0.1l0,0l0.4,0.8c0.2,0.4,0.7,0.6,1.2,0.4l0.3,0.2 l0.3,0.6c0.2,0.3,0.6,0.5,0.9,0.3l0.8,0.6l0.1,0.2c0.1,0.2,0.3,0.3,0.5,0.3l0.6,0.5l2.3,1.9l1.8,1.4c0.4,0.3,0.8,0.2,1.1-0.2 C21.4,19,21.4,18.8,21.4,18.6z"></path>
  </svg>
};

class BoarderContainer extends React.Component<{|
  renderContent?: ({ width: number, height: number}) => React.Node,
  children?: void,
  state: $ReadOnly<{|
    game: Game | void,
    isDebug: boolean,
    isHand: boolean,
    playerId: string | void
  |}>,
|}, any> {
  constructor() {
    super();
    this.state = {
      width: 0,
      height: 0,
    }
  }
  componentDidMount() {
    window.onresize = () => {
      this.setState({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
  }
  render() {
    return <div style={{
      margin: 0,
      fontFamily: 'Futura',
      width: window.innerWidth,
      height: window.innerHeight,
      overflow: 'hidden',
      position: 'absolute',
    }}>
      { this.props.renderContent ? this.props.renderContent({width:  this.state.width, height: this.state.height}) : null }
      {this.props.state.isDebug ?
        <div style={{left: 0, top: 0, width: 300, height: '100%', position: 'absolute', overflow: 'scroll'}}>
          <pre>{JSON.stringify(this.props.state.game, null, 2)}</pre>
        </div> : null}
      <style global jsx>{`
        body {
          margin: 0;
        }
      `}</style>
    </div>;
  }
}

function checkIsMobile() {
  var ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(ua);
}

function getRoleMessage(me, game: Game) {
  const isHitler = game.hitler === (me && me.id);
  const isFacist = me && me.role === 'fascist';
  const fascists = game.players
    .filter(player => player.role === 'fascist' && (player.id !== (me && me.id)));
  if (isHitler) {
    if (game.players.length <= 6) {
      return `You're Hitler! The other facists are: ${fascists.map(f => f.name).join(', ')}.`;
    } else {
      return `You're Hitler! Because this game has 7 or more players, you'll have to guess who the other fascists are.`;
    }
  }
  if (isFacist) {
    const withoutHitler = fascists.filter(fascist => fascist.id !== game.hitler);
    const hitler = fascists.filter(fascist => fascist.id === game.hitler)[0];
    if (withoutHitler.length > 0) {
      return `You're a facist. The other facists are: ${withoutHitler.map(f => f.name).join(', ')} and Hitler is ${hitler.name}`;
    } else {
      return `You're a facist and Hitler is ${hitler.name}`;
    }
  }
  return `You're a liberal`;
}

function getPlayer(playerId: string, game: Game) {
  const index = game.players.reduce((accum, player, index) => {
    if (player.id === playerId) {
      return index;
    }
    return accum;
  }, -1);
  if (index === -1) {
    return undefined;
  }
  return game.players[index];
}

const canJoin = ({game}) => game && game.isStarted === false && game.players.length <= 10;
const canStart = ({game}) => game && game.isStarted === false && game.players.length >= 5;
const isObserver = ({game, playerId}: State) => game && game.isStarted && !game.players.find(player => player.id === playerId);
const canStartMessage = ({game}) => {
  if (canStart({game})) {
    return ` We have enough players to begin but a few more can't hurt`;
  }
  const players = (game && game.players || []).length;
  const needed = 5 - players;
  return `Still looking for ${needed} more player${needed > 1 ? 's' : ''}`;
}
// @flow

import React, { Component } from 'react';
import io from 'socket.io-client';
import type { Message, Game } from '../types.mjs';
import { assert } from '../utils.mjs';

type State = {|
  isHand: boolean,
  isDebug: boolean,
  playerId: string | void,
  game: Game | void
|};

export default class Home extends Component<{||}, State> {
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

  render() {
    if (this.state.isHand) {
      return <Hand
        state={this.state}
        onStart={this.onStart}
        onRevealRole={this.onRevealRole}
        onUpdateName={this.onUpdateName}
        onSelectChancellorCandidate={this.onSelectChancellorCandidate}
        voteOnTicket={this.voteOnTicket}
        />;
    }
    return <Board state={this.state} />;
  }
}

function Hand({
  state,
  onStart,
  onRevealRole,
  onUpdateName,
  onSelectChancellorCandidate,
  voteOnTicket,
}: {|
  state: State,
  onStart: () => void,
  onRevealRole: () => void,
  onUpdateName: (SyntheticKeyboardEvent<HTMLInputElement>) => void,
  onSelectChancellorCandidate: (playerId: string) => void,
  voteOnTicket: (playerId: string, vote: 'ja' | 'nein') => void,
|}) {
  const { playerId, game } = state;
  const player = playerId && game && getPlayer(playerId, game) || undefined;
  if (!player || !game || !playerId) {
    return <div></div>;
  }
  return <div>
    <button onClick={onStart}>Start</button>
    <button onClick={onRevealRole}>Reveal role</button>
    <div>
      <span>name</span>
      <input type="text" onChange={onUpdateName} value={player.name}></input>
    </div>
    { player.revealRole ? <div>
      <span>{getRoleMessage(player, game)}</span>
      <img style={{width: '100%'}} src={player.id === game.hitler ? 'static/hitler.png' : `static/${player.role || 'liberal'}.png`} />
    </div> : null}
    { game.phase === 'ELECTION_START' && player.id === game.presidentialCandidate ? <div>
      You're the presidential candidate. Pick your chancellor candidate.
      <ul>
        {game.players
          .filter(player => {
            return player.id !== playerId
              && player.id !== game.electedPresident
              && player.id !== game.electedChancellor;
          }).map(player => {
          return <li><button onClick={() => onSelectChancellorCandidate(player.id)}>{player.name}</button></li>
        })}
      </ul>
    </div> : null}
    { game.phase === 'VOTE_ON_TICKET' ? <div>
      <h1> Vote on the ticket </h1>
      <button onClick={() => voteOnTicket(playerId, 'ja')}>Ja</button>
      <button onClick={() => voteOnTicket(playerId, 'nein')}>Nien</button>
    </div> : null}
    {state.isDebug ? <pre>{JSON.stringify(state, null, 2)}</pre> : null}
    playerId {playerId}
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
  if (game.phase === 'VIEW_ROLES') {
    return (
      <BoarderContainer state={state}>
        <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
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
        </div>
      </BoarderContainer>
    );
  }
  if (game.phase === 'ELECTION_START') {
    const presidentialCandidate = game.players.find(player => player.id === game.presidentialCandidate);
    if (!presidentialCandidate) {
      throw new Error(`No presidential candidate`);
    }
    return (
      <BoarderContainer state={state}>
        <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}></div>
          <div style={{flexGrow: 1, textAlign: 'center'}}>
            <h1 style={{fontSize: 100}}> Election </h1>
            <h2>President candidate {presidentialCandidate.name}, please select your chancellor candidate.</h2>
          </div>
        </div>
      </BoarderContainer>
    );
  }
  if (game.phase === 'VOTE_ON_TICKET') {
    return (
      <BoarderContainer state={state}>
        <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}></div>
          <div style={{flexGrow: 1, textAlign: 'center'}}>
            <h1 style={{fontSize: 100}}> Vote on ticket </h1>
            <h2> {game.players.filter(player => player.vote === undefined).length} player(s) still need to vote.</h2>
          </div>
          <div style={{flexGrow: 1}}></div>
        </div>
      </BoarderContainer>
    )
  }
  if (game.phase === 'REVEAL_TICKET_RESULTS') {
    const jas = game.players.reduce((jas:  number, player) => {
      return player.vote === 'ja' ? jas + 1 : jas;
    }, 0);
    const win = jas > (game.players.length / 2);
    return (
      <BoarderContainer state={state}>
        <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
          <div style={{flexGrow: 1}}></div>
          <div style={{flexGrow: 1, textAlign: 'center'}}>
            <h1 style={{fontSize: 100}}> { win ? 'Success' : 'Failure' }</h1>
            <div style={{display: 'flex', flexDirection: 'row', width: '100%', height: '100%'}}>
              <div style={{flexGrow: 1}}></div>
              <div style={{textAlign: 'left'}}>
                {game.players.map(player => {
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
      </BoarderContainer>
    );
  }
  if (game.phase === 'LEGISLATIVE_SESSION_START') {
    const chancellor = getPlayer(game.electedChancellor || '', game);
    const president = getPlayer(game.electedPresident || '', game);
    if (!chancellor || !president) {
      throw new Error(`Chancellor or president is not set`);
    }
    return (
      <BoarderContainer state={state}>
        <div style={{textAlign: 'center', marginTop: '25%'}}>
          <h1> Legislative session has started with  Chancellor {chancellor.name} and President {president.name} </h1>
        </div>
      </BoarderContainer>
    );
  }
  return <BoarderContainer state={state}>
    <div style={{display: 'flex', flexDirection: 'column', width: '100%', height: '100%'}}>
      <div style={{flexGrow: 1}}><SecretHitlerLogo /></div>
      <div style={{flexGrow: 2, textAlign: 'center', fontSize: 50, fontWeight: 'bold'}}>
        { canJoin(state) ?
          <div>{(canStart(state) ? ` We have enough players to begin but a few more can't hurt.` : ` Still looking for ${5 - game.players.length} more players.`)}</div>
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
  </BoarderContainer>;
}

const Bird = () => {
  return <svg height="39.2" width="43.2" viewBox="0 0 21.6 19.6" style={{transform: `rotate(-90deg)`}}>
    <path d="M21.4,18.6l-0.4-1c0-0.1,0-0.1,0-0.2l-2.1-4.7l0,0l-0.3-0.6l-0.6-1.2c-0.2-0.5-0.5-0.9-0.9-1.2l0,0l-4-2.5 c0-0.2,0-0.4-0.1-0.6l3.7-1.3L18,4.5l3.1-4l-0.3-0.5l-4.2,2.5l-0.8,0.2l-2.6,0.6c0.2-0.4,0.4-0.8,0.6-1.2c0-0.9-0.7-1.6-1.6-1.5 c0,0,0,0,0,0c-0.2,0-0.4,0-0.6,0.1l0,0l-2,0.3l1,0.8L8.4,2.2C7.3,2.4,6.4,3.3,6,4.4L5.4,6.6l0,0C5.3,6.8,5.2,7.1,5.2,7.4l-2,0.2 c-0.1,0-0.2,0-0.4,0c0,0,0,0-0.1,0.1l-1,0.1l-1.8,2.2v1.6h0.2c0,0.2,0,0.3,0.2,0.4l1-0.1l-1,0.6C0.1,12.7,0,12.9,0,13.2l0,0l0.3,1.2 c0,0.1,0,0.3,0.1,0.4l0,0h0.1c0,0,0.1,0,0.1,0l1.4,0.4L2,14.9c0.1-0.1,0.3-0.1,0.4-0.2L6,11.1l2-1.9l0.7,1.5 c0.1,0.3,0.3,0.5,0.6,0.5l0.3,0.3L10,12c0.1,0.3,0.5,0.5,0.9,0.4c0,0,0.1,0,0.1-0.1l0,0l0.4,0.8c0.2,0.4,0.7,0.6,1.2,0.4l0.3,0.2 l0.3,0.6c0.2,0.3,0.6,0.5,0.9,0.3l0.8,0.6l0.1,0.2c0.1,0.2,0.3,0.3,0.5,0.3l0.6,0.5l2.3,1.9l1.8,1.4c0.4,0.3,0.8,0.2,1.1-0.2 C21.4,19,21.4,18.8,21.4,18.6z"></path>
  </svg>
};

class BoarderContainer extends Component<any, any> {
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
      fontFamily: 'Helvetica',
      width: window.innerWidth,
      height: window.innerHeight,
      overflow: 'hidden',
      position: 'absolute',
    }}>
      {this.props.children}
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

const canJoin = ({game}: State) => game && game.isStarted === false && game.players.length <= 10;
const canStart = ({game}: State) => game && game.isStarted === false && game.players.length >= 5;
const isObserver = ({game, playerId}: State) => game && game.isStarted && !game.players.find(player => player.id === playerId);

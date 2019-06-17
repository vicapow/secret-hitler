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
  </div>;
}

function Board({state}: {| state: State |}) {
  const { game } = state;
  if (!game) {
    return <div></div>;
  }
  if (game.phase === 'VIEW_ROLES') {
    return (
      <div>
        <h1>Everyone view your role!</h1>
        <ul>
          {game.players.map(player => {
            return (<li>
              <span>{player.name}</span>
              <span> </span>
              <span>{player.seenRole ? '🤭' : '🙈'}</span>
            </li>);
          })}
        </ul>
        {state.isDebug ? <pre>{JSON.stringify(state, null, 2)}</pre> : null}
      </div>
    );
  }
  if (game.phase === 'ELECTION_START') {
    const presidentialCandidate = game.players.find(player => player.id === game.presidentialCandidate);
    if (!presidentialCandidate) {
      throw new Error(`No presidential candidate`);
    }
    return (
      <div>
        <h1> Election </h1>
        <p>
          President candidate {presidentialCandidate.name}, please select your chancellor candidate.
        </p>
        {state.isDebug ? <pre>{JSON.stringify(state, null, 2)}</pre> : null}
      </div>
    );
  }
  if (game.phase === 'VOTE_ON_TICKET') {
    return (
      <div>
        <h1> Vote on ticket </h1>
        <p>
          {game.players.filter(player => player.vote === undefined).length} player(s) need to vote.
        </p>
        {state.isDebug ? <pre>{JSON.stringify(state, null, 2)}</pre> : null}
      </div>
    )
  }
  if (game.phase === 'REVEAL_TICKET_RESULTS') {
    const jas = game.players.reduce((jas:  number, player) => {
      return player.vote === 'ja' ? jas + 1 : jas;
    }, 0);
    const win = jas > (game.players.length / 2);
    return (
      <div>
        <h1> { win ? 'Success' : 'Failure' }</h1>
        <ul>
          {game.players.map(player => {
            return <li>{player.name} voted {player.vote}</li>
          })}
        </ul>
      </div>
    );
  }
  if (game.phase === 'LEGISLATIVE_SESSION_START') {
    const chancellor = getPlayer(game.electedChancellor || '', game);
    const president = getPlayer(game.electedPresident || '', game);
    if (!chancellor || !president) {
      throw new Error(`Chancellor or president is not set`);
    }
    return (
      <div>
        <h1> Legislative session has started with  Chancellor {chancellor.name} and President {president.name} </h1>
      </div>
    );
  }
  return <div>
    Board
    {state.isDebug ? <pre>{JSON.stringify(state, null, 2)}</pre> : null}
  </div>;
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

// @flow

import * as React from 'react';
import io from 'socket.io-client';
import Head from 'next/head';
import type { Message, Game } from '../types.mjs';
import {
  assert,
  latestPolicy,
  isOver,
  fascistsWon,
  explainVictory,
  explainVictoryAudio
} from '../utils.mjs';

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
    const playerId /*: string | void */ =
      (isHand &&
        (urlParams.get('playerId') ||
          window.localStorage.getItem('playerId') ||
          String(Math.random()))) ||
      undefined;
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
    this.sendMessage({ type: 'START_GAME' });
  };

  onRevealRole = () => {
    if (this.state.playerId) {
      this.sendMessage({ type: 'REVEAL_ROLE', body: { playerId: this.state.playerId } });
    }
  };

  onMessage = (message: Message) => {
    let player;
    let { game, isHand, playerId } = this.state;
    if (message.type === 'UPDATE_GAME_STATE') {
      game = message.body.game;
      if (this.state.playerId) {
        player = (game && getPlayer(this.state.playerId, game)) || undefined;
        if (!player && isHand && !game.isStarted && typeof playerId === 'string') {
          this.sendMessage({
            type: 'PLAYER_JOIN',
            body: { playerId }
          });
        }
      }
    }
    this.setState({ game });
  };

  onUpdateName = (e: SyntheticKeyboardEvent<HTMLInputElement>) => {
    const name = e.currentTarget.value;
    if (this.state.playerId) {
      this.sendMessage({
        type: 'UPDATE_PLAYER_NAME',
        body: { name, playerId: this.state.playerId }
      });
    }
  };

  onSelectChancellorCandidate = (playerId: string) => {
    this.sendMessage({
      type: 'SELECT_CHANCELLOR_CANDIDATE',
      body: { playerId }
    });
  };

  voteOnTicket = (playerId: string, vote: 'ja' | 'nein') => {
    this.sendMessage({
      type: 'VOTE_ON_TICKET',
      body: { playerId, vote }
    });
  };

  presidentDiscardPolicy = (policyId: string) => {
    this.sendMessage({
      type: 'PRESIDENT_DISCARD_POLICY',
      body: { policyId }
    });
  };

  chancellorDiscardPolicy = (policyId: string) => {
    this.sendMessage({
      type: 'CHANCELLOR_DISCARD_POLICY',
      body: { policyId }
    });
  };

  doneExaminingDeck = () => {
    this.sendMessage({ type: 'DONE_EXAMINING_DECK' });
  };

  killPlayer = (playerId: string) => {
    this.sendMessage({ type: 'KILL_PLAYER', body: { playerId } });
  };

  renderGame = () => {
    if (this.state.isHand) {
      return (
        <React.Fragment>
          <Head>
            <title>Secret Hitler</title>
            <meta name="viewport" content="initial-scale=1.0, width=device-width" />
          </Head>
          <Hand
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
          />
        </React.Fragment>
      );
    }
    return <Board state={this.state} />;
  };

  render() {
    return (
      <React.Fragment>
        <div className="flex flex-col h-full text-red-100">
          <div className="flex-1 container mx-auto">{this.renderGame()}</div>
          <div className="w-full text-center text-sm text-red-300 p-4 pin-b">
            <span>
              2016–2019 GOAT, WOLF, & CABBAGE ˙ CC SA–BY–NC 4.0 ˙ SECRETHITLERGAME@GMAIL.COM
            </span>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

function HandButton(props) {
  return (
    <button
      className="shadow-md bg-orange-900 text-white font-bold py-2 px-4 my-2 rounded w-full"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
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
  killPlayer
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
  killPlayer: (playerId: string) => void
|}) {
  const { playerId, game } = state;
  const player = (playerId && game && getPlayer(playerId, game)) || undefined;
  if (!player || !game || !playerId) {
    return <div />;
  }
  const role = player.role;
  if (player.killed) {
    return (
      <div>
        <h1> You're dead </h1>
        <p>
          {' '}
          Please wait quietly until the end of the game. Definitely not reveal your identity or give
          any hits!{' '}
        </p>
      </div>
    );
  }
  const presidentCandidate = getPlayer(game.presidentCandidate || '', game);
  const chancellorCandidate = getPlayer(game.chancellorCandidate || '', game);
  return (
    <div className="container mx-auto px-2 py-2 text-2xl">
      {!game.isStarted && canStart({ game }) ? (
        <HandButton onClick={onStart}>Start the game?</HandButton>
      ) : null}
      {!game.isStarted && !canStart({ game }) ? (
        <div className="text-center mb-4 mt-4">
          <div>{canStartMessage({ game })}</div>
        </div>
      ) : null}
      <div className="pt-0 mb-2 flex items-center">
        <div className="flex-1">
          <input
            placeholder="name"
            type="text"
            className="text-gray-900 p-2 w-full"
            onChange={onUpdateName}
            value={player.name}
          />
        </div>

        {role !== undefined ? (
          <div className="flex-2">
            <div className="ml-2">
              <HandButton onClick={onRevealRole}>
                {player.revealRole ? `Hide role` : `Reveal role`}
              </HandButton>
              {player.revealRole ? (
                <div className="text-center p-2 flex flex-col content-center fixed bg-gray-900 mr-2 shadow-lg rounded-lg">
                  <div className="mb-2">{getRoleMessage(player, game)}</div>
                  <img
                    src={player.id === game.hitler ? 'static/hitler.png' : `static/${role}.png`}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {game.phase.name === 'ELECTION_START' && player.id === game.presidentCandidate ? (
        <div>
          <div className="text-center">
            You are<div className="text-4xl">presidential candidate</div> Pick your chancellor
            candidate:
          </div>
          <div>
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
                if (
                  game.players.filter(player => !player.killed).length > 5 &&
                  player.id === game.electedPresident
                ) {
                  // presidents are not term limited when there are 5 or fewer players.
                  return false;
                }
                return true;
              })
              .map(player => {
                return (
                  <div>
                    <HandButton onClick={() => onSelectChancellorCandidate(player.id)}>
                      {player.name}
                    </HandButton>
                  </div>
                );
              })}
          </div>
        </div>
      ) : game.phase.name === 'ELECTION_START' ? <div>
        {(() => {
          const presidentCandidate = game.players.find(player => player.id === game.presidentCandidate);
          if (!presidentCandidate) return null;

          return <div className="text-center text-4xl">Presidential candidate <PlayerLabel>{presidentCandidate.name}</PlayerLabel> is selecting their Chancellor. Please nudge them if they are too slow.</div>
        })()}
      </div> : null }
      {game.phase.name === 'VOTE_ON_TICKET' ? (
        <div>
          <h1 className="text-center uppercase text-4xl">Vote!</h1>
          <div className="flex flex-row items-stretch justify-around">
            <div className="flex flex-col items-center mb-2">
              <div>President:</div>
              <div>
                <PlayerLabel>{presidentCandidate ? presidentCandidate.name : ''}</PlayerLabel>
              </div>
            </div>
            <div className="flex flex-col items-center mb-2">
              <div>Chancellor:</div>
              <div>
                <PlayerLabel>{chancellorCandidate ? chancellorCandidate.name : ''}</PlayerLabel>
              </div>
            </div>
          </div>
          {player.vote === undefined ? (
            <div>
              <HandButton onClick={() => voteOnTicket(playerId, 'ja')}>Ja</HandButton>
              <HandButton onClick={() => voteOnTicket(playerId, 'nein')}>Nien</HandButton>
            </div>
          ) : (
            <div className="text-center text-4xl">
              You voted:{' '}
              <div>
                <BigLabel>{player.vote}</BigLabel>
              </div>
            </div>
          )}
          <div className="text-center pt-4">
            Waiting on{' '}
            {game.players.filter(player => player.vote === undefined && !player.killed).length}{' '}
            player(s)
          </div>
        </div>
      ) : null}
      {game.phase.name === 'LEGISLATIVE_SESSION_START' && game.electedPresident === playerId ? (
        <div>
          <h1 className="text-center mb-2"> Pick which policy to discard </h1>
          <div className="flex p-4 bg-gray-900 rounded-lg">
            {game.policies
              .filter(policy => policy.location === 'president')
              .map(policy => {
                return (
                  <div onClick={() => presidentDiscardPolicy(policy.id)}>
                    <img src={`static/${policy.type}-policy.png`} />
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}
      {game.phase.name === 'CHANCELLOR_POLICY_TURN' && game.electedChancellor === playerId
        ? (() => {
            const [policy1, policy2] = game.policies.filter(
              policy => policy.location === 'chancellor'
            );
            return (
              <div>
                <h1 className="text-center mb-2"> Pick which policy to enact: </h1>
                <div className="flex p-4 bg-gray-900 rounded-lg">
                  <div onClick={() => chancellorDiscardPolicy(policy2.id)}>
                    <img src={`static/${policy1.type}-policy.png`} />
                  </div>
                  <div onClick={() => chancellorDiscardPolicy(policy1.id)}>
                    <img src={`static/${policy2.type}-policy.png`} />
                  </div>
                </div>
              </div>
            );
          })()
        : null}
      {game.phase.name === 'PRESIDENT_EXAMINE_DECK_START' && game.electedPresident === playerId ? (
        <div>
          <h1 className="text-center text-4xl">Review the top 3 cards in the deck:</h1>
          <div className="flex p-4 bg-gray-900 rounded-lg">
            {game.policies
              .filter(policy => policy.location === 'deck')
              .slice(0, 3)
              .map(policy => {
                return (
                  <div s>
                    <img src={`static/${policy.type}-policy.png`} />
                  </div>
                );
              })}
          </div>
          <HandButton onClick={() => doneExaminingDeck()}>Ok, I remember them. Continue game!</HandButton>
        </div>
      ) : null}
      {game.phase.name === 'PRESIDENT_KILL_START' && game.electedPresident === playerId ? (
        <div>
          <h1>Pick a player to kill</h1>
          <div>
            <div>
              {game.players
                .filter(player => player.id !== playerId && !player.killed)
                .map(player => {
                  return (
                    <HandButton onClick={() => killPlayer(player.id)}>{player.name}</HandButton>
                  );
                })}
            </div>
          </div>
        </div>
      ) : null}
      {state.isDebug ? `playerId ${playerId}` : null}
      {state.isDebug ? <pre>{JSON.stringify(state, null, 2)}</pre> : null}
    </div>
  );
}

const BigLabel = props => (
  <span className="font-bold uppercase inline-block px-4 shadow-md bg-red-900 text-white py-2 px-4 m-y-2 rounded">
    {props.children}
  </span>
);

const PlayerLabel = props => (
  <span className="font-bold inline-block px-4 shadow-md bg-blue-900 text-white leading-none py-2 px-4 m-y-2 rounded">
    {props.children}
  </span>
);

const SecretHitlerLogo = () => (
  <div className="object-none object-right-bottom">
    <img src="static/secret-hitler-logo-wide.png" />
  </div>
);

function Board({ state }: {| state: State |}) {
  const { game } = state;
  if (!game) {
    return <SecretHitlerLogo />;
  }
  if (isOver(game)) {
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <div />
              <div>
                <h1>{fascistsWon(game) ? `Fascists` : `Liberals`} Won!</h1>
                <p>{explainVictory(game)}</p>
                <audio src={explainVictoryAudio(game)} autoPlay />
              </div>
              <div>
                <div>
                  {game.players.map(player => {
                    return (
                      <div>
                        <div>
                          <span>{player.name}</span>
                          <img
                            src={
                              player.id === game.hitler
                                ? 'static/hitler.png'
                                : `static/${player.role || ''}.png`
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }}
      />
    );
  }
  if (game.phase.name === 'VIEW_ROLES') {
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <div />
              <div>
                <h1 className="text-center">
                  Everyone view your role! (But don't reveal it to others)
                </h1>
                <audio src="static/view-role.mp3" autoPlay />
                <div className="flex flex-col items-center  mt-2">
                  {game.players.map((player, index) => {
                    return (
                      <React.Fragment>
                        <div className="flex items-center">
                          <div className="mr-2">{player.seenRole ? '🤭' : '🙈'}</div>

                          <div>
                            <PlayerLabel>{player.name}</PlayerLabel>
                          </div>
                        </div>
                        {player.seenRole && index % 4 === 0 ? (
                          <audio src="static/splunk.mp3" autoPlay />
                        ) : null}
                        {player.seenRole && index % 4 === 1 ? (
                          <audio src="static/drump-tap.mp3" autoPlay />
                        ) : null}
                        {player.seenRole && index % 4 === 2 ? (
                          <audio src="static/cork.mp3" autoPlay />
                        ) : null}
                        {player.seenRole && index % 4 === 3 ? (
                          <audio src="static/kapuka.mp3" autoPlay />
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              <div />
            </div>
          );
        }}
      />
    );
  }
  if (game.phase.name === 'ELECTION_START') {
    const presidentCandidate = game.players.find(player => player.id === game.presidentCandidate);
    if (!presidentCandidate) {
      throw new Error(`No presidential candidate`);
    }
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <div />
              <div>
                <h1 className="text-center text-6xl uppercase">Election</h1>
                <audio src="static/election.mp3" autoPlay />
                <h2 className="text-center text-4xl">
                  President candidate <br />
                  <PlayerLabel>{presidentCandidate.name}</PlayerLabel>
                  <br />
                  Select your chancellor candidate!
                </h2>
              </div>
            </div>
          );
        }}
      />
    );
  }
  if (game.phase.name === 'VOTE_ON_TICKET') {
    const presidentCandidate = getPlayer(game.presidentCandidate || '', game);
    const chancellorCandidate = getPlayer(game.chancellorCandidate || '', game);
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <div>
                <h1 className="text-center uppercase text-4xl">Vote On Your Phone!</h1>
                <div className="flex flex-row items-stretch justify-around">
                  <div className="flex flex-col items-center mb-2">
                    <div>President Candidate:</div>
                    <div>
                      <PlayerLabel>{presidentCandidate ? presidentCandidate.name : ''}</PlayerLabel>
                    </div>
                  </div>
                  <div className="flex flex-col items-center mb-2">
                    <div>Chancellor Candidate:</div>
                    <div>
                      <PlayerLabel>
                        {chancellorCandidate ? chancellorCandidate.name : ''}
                      </PlayerLabel>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-row items-center m-auto">
                <div className="m-auto p-8">
                  {game.players
                    .filter(player => !player.killed)
                    .map((player, index) => {
                      return (
                        <div className="flex">
                          <div className="mr-4">{player.vote !== undefined ? '🗳️' : '⌛'}</div>
                          <div className="">
                            <PlayerLabel>{player.name}</PlayerLabel>
                          </div>
                        </div>
                      );
                    })}
                  {game.players
                    .filter(player => !player.killed && player.vote !== undefined)
                    .map((player, index) => {
                      return (
                        <div>
                          {index === 0 && game.phase.timestamp + 2000 < Date.now() ? (
                            <audio src="static/oh-theres-one.mp3" autoPlay />
                          ) : (
                            ''
                          )}
                          {index !== 0 && game.phase.timestamp + 2000 < Date.now() ? (
                            <audio src="static/splunk.mp3" autoPlay />
                          ) : (
                            ''
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          );
        }}
      />
    );
  }
  if (game.phase.name === 'REVEAL_TICKET_RESULTS') {
    const jas = game.players.reduce((jas: number, player) => {
      return player.vote === 'ja' ? jas + 1 : jas;
    }, 0);
    const win = jas > game.players.filter(player => !player.killed).length / 2;
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={() => {
          return (
            <div className="flex flex-col">
              <h1 className="text-center mb-2"> {win ? 'Success' : 'Failure'}</h1>
              {<audio src={win ? 'static/success.mp3' : 'static/failed.mp3'} autoPlay />}

              <div className="flex flex-col">
                {game.players
                  .filter(player => !player.killed)
                  .map(player => {
                    const { vote } = player;
                    return (
                      <div className="flex flex-row items-center mb-2">
                        <div className="mr-2">
                          {vote ? (
                            <img src={`static/${vote}.png`} style={{ height: '48px' }} />
                          ) : null}
                        </div>
                        <div className="flex-2">
                          <PlayerLabel>{player.name}</PlayerLabel>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        }}
      />
    );
  }
  if (
    game.phase.name === 'LEGISLATIVE_SESSION_START' ||
    game.phase.name === 'CHANCELLOR_POLICY_TURN'
  ) {
    const chancellor = getPlayer(game.electedChancellor || '', game);
    const president = getPlayer(game.electedPresident || '', game);
    if (!chancellor || !president) {
      throw new Error(`Chancellor or president is not set`);
    }
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <h1 className="text-4xl text-center mb-4">The legislative session has started. </h1>

              <div className="flex px-8">
                <div className="flex flex-col items-center">
                  <div className="mb-2 mr-2">
                    <PlayerLabel>{president.name}</PlayerLabel>
                  </div>
                  <div>
                    <img src="static/president.png" />
                  </div>
                  <div>
                    {game.phase.name === 'LEGISLATIVE_SESSION_START' ? (
                      <div className="flex">
                        <div className="mx-8" />
                        <div>
                          <img src="static/policy.png" />
                        </div>
                        <div>
                          <img src="static/policy.png" />
                        </div>
                        <div>
                          <img src="static/policy.png" />
                        </div>
                        <div className="mx-8" />
                        <audio src="static/president-discard.mp3" autoPlay />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex px-8">
                  <div className="flex flex-col items-center">
                    <div className="mb-2 mr-2">
                      <PlayerLabel>{chancellor.name}</PlayerLabel>
                    </div>
                    <div>
                      <img src="static/chancellor.png" />
                    </div>
                    <div>
                      {game.phase.name === 'CHANCELLOR_POLICY_TURN' ? (
                        <div className="flex">
                          <div className="mx-8" />
                          <div>
                            <img src="static/policy.png" />
                          </div>

                          <div>
                            <img src="static/policy.png" />
                          </div>
                          <div className="mx-8" />
                          <audio src="static/president-discard.mp3" autoPlay />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div />
              </div>

              <div />
            </div>
          );
        }}
      />
    );
  }
  if (game.phase.name === 'REVEAL_NEW_POLICY') {
    const policy = latestPolicy(game);
    if (!policy) {
      throw new Error(`Policy not set`);
    }
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <div />
              <div className="flex flex-col items-center">
                <h1> New Policy Enacted! </h1>
                <img src={`static/${policy.type}-policy.png`} />
                <audio src={`static/${policy.type}-revealed.mp3`} autoPlay />
              </div>
              <div />
            </div>
          );
        }}
      />
    );
  }
  if (game.phase.name === 'SHUFFLE_DECK') {
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <div />
              <div>
                <h1> Shuffling deck... </h1>
              </div>
              <div />
            </div>
          );
        }}
      />
    );
  }
  if (game.phase.name === 'REVEAL_POLICIES') {
    return (
      <BoardContainer
        showPolicyStatus={false}
        showPolicyStatus={false}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <div />
              <div>
                <h1 className="text-center mt-8 mb-8">Current Policies:</h1>
                <div>
                  <div />
                  <div>
                    <PolicyStatus game={game} />
                  </div>
                  <div />
                </div>
              </div>
              <div />
            </div>
          );
        }}
      />
    );
  }
  if (game.phase.name === 'PRESIDENT_EXAMINE_DECK_START') {
    const president = getPlayer(game.electedPresident || '', game);
    if (!president) {
      throw new Error('something went wrong');
    }
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <div>
                <div>
                  <div>
                    <h1 className="text-center">
                      Too Many Fascist Policies! <br />
                      President <PlayerLabel>{president.name}</PlayerLabel>, has a special power to examine the top 3 cards
                      in the deck
                    </h1>
                    <audio src="static/review-top-three-cards.mp3" autoPlay />
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      />
    );
  }
  if (game.phase.name === 'PRESIDENT_KILL_START') {
    const president = getPlayer(game.electedPresident || '', game);
    if (!president) {
      throw new Error('something went wrong');
    }
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <div>
                <div>
                  <div>
                    <h1>The President {president.name} is considering who to kill...</h1>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      />
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
      throw new Error('something went wrong');
    }
    return (
      <BoardContainer
        showPolicyStatus={true}
        state={state}
        renderContent={({ width, height }: { width: number, height: number }) => {
          return (
            <div>
              <div>
                <div>
                  <div>
                    <h1>{mostRecentlyKilled.name} was killed!</h1>
                  </div>
                </div>
              </div>
            </div>
          );
        }}
      />
    );
  }
  return (
    <BoardContainer
      showPolicyStatus={false}
      state={state}
      renderContent={() => {
        return (
          <div>
            <div>
              <SecretHitlerLogo />
            </div>
            <audio src="static/intro.mp3" autoPlay />
            <div>
              {canJoin(state) ? (
                <div className="text-center">
                  {canStartMessage(state)}
                  {canStart({ game }) ? <audio src="static/can-start.mp3" autoPlay /> : null}
                </div>
              ) : (
                <div> We're full! Someone start the game.</div>
              )}
            </div>
            <div>
              <div className="mt-8 p-8">
                {game.players.map(player => {
                  return (
                    <div key={player.id} className="flex">
                      <div className="mr-8 flex items-center">
                        <Bird />
                      </div>
                      <span> </span>
                      <audio src="static/splunk.mp3" autoPlay />
                      {player.name}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}

function PolicyStatus({ game }: { game: Game }) {
  const liberalPolicies = game.policies.filter(policy => policy.location === 'liberal');
  const fascistPolicies = game.policies.filter(policy => policy.location === 'fascist');
  return (
    <div className="flex mt-2">
      <div className="flex-1">
        <div className="text-center">
          Liberal policies: <BigLabel>{liberalPolicies.length}</BigLabel>
        </div>

        <div className="relative overflow-hidden">
          <img src="static/liberal-board.png" />

          <div
            className="flex"
            style={{
              width: '68.3%',
              margin: 'auto',
              top: '24%',
              left: '16.1%',
              position: 'absolute',
              minHeight: '100%'
            }}
          >
            {liberalPolicies.map((p, i) => (
              <div style={{ width: '20%', padding: '5px' }}>
                <img
                  src="static/liberal-policy.png"
                  className="relative"
                  style={{ marginTop: '' }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1">
        <div className="text-center">
          Fascist policies: <BigLabel>{fascistPolicies.length}</BigLabel>
        </div>
        <div className="relative overflow-hidden">
          <img src="static/fascist-board-56.png" />
          <div
            className="flex"
            style={{
              width: '81%',
              margin: 'auto',
              top: '24%',
              left: '9.6%',
              position: 'absolute',
              minHeight: '100%'
            }}
          >
            {fascistPolicies.map((p, i) => (
              <div className="" style={{ width: '16.666%', padding: '5px' }}>
                <img src="static/fascist-policy.png" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const Bird = () => {
  return (
    <svg height="39.2" width="43.2" viewBox="0 0 21.6 19.6" className="fill-current text-red-100">
      <path d="M21.4,18.6l-0.4-1c0-0.1,0-0.1,0-0.2l-2.1-4.7l0,0l-0.3-0.6l-0.6-1.2c-0.2-0.5-0.5-0.9-0.9-1.2l0,0l-4-2.5 c0-0.2,0-0.4-0.1-0.6l3.7-1.3L18,4.5l3.1-4l-0.3-0.5l-4.2,2.5l-0.8,0.2l-2.6,0.6c0.2-0.4,0.4-0.8,0.6-1.2c0-0.9-0.7-1.6-1.6-1.5 c0,0,0,0,0,0c-0.2,0-0.4,0-0.6,0.1l0,0l-2,0.3l1,0.8L8.4,2.2C7.3,2.4,6.4,3.3,6,4.4L5.4,6.6l0,0C5.3,6.8,5.2,7.1,5.2,7.4l-2,0.2 c-0.1,0-0.2,0-0.4,0c0,0,0,0-0.1,0.1l-1,0.1l-1.8,2.2v1.6h0.2c0,0.2,0,0.3,0.2,0.4l1-0.1l-1,0.6C0.1,12.7,0,12.9,0,13.2l0,0l0.3,1.2 c0,0.1,0,0.3,0.1,0.4l0,0h0.1c0,0,0.1,0,0.1,0l1.4,0.4L2,14.9c0.1-0.1,0.3-0.1,0.4-0.2L6,11.1l2-1.9l0.7,1.5 c0.1,0.3,0.3,0.5,0.6,0.5l0.3,0.3L10,12c0.1,0.3,0.5,0.5,0.9,0.4c0,0,0.1,0,0.1-0.1l0,0l0.4,0.8c0.2,0.4,0.7,0.6,1.2,0.4l0.3,0.2 l0.3,0.6c0.2,0.3,0.6,0.5,0.9,0.3l0.8,0.6l0.1,0.2c0.1,0.2,0.3,0.3,0.5,0.3l0.6,0.5l2.3,1.9l1.8,1.4c0.4,0.3,0.8,0.2,1.1-0.2 C21.4,19,21.4,18.8,21.4,18.6z" />
    </svg>
  );
};

class BoardContainer extends React.Component<
  {|
    renderContent?: ({ width: number, height: number }) => React.Node,
    children?: void,
    showPolicyStatus: boolean,
    state: $ReadOnly<{|
      game: Game | void,
      isDebug: boolean,
      isHand: boolean,
      playerId: string | void
    |}>
  |},
  any
> {
  constructor() {
    super();
    this.state = {
      width: 0,
      height: 0
    };
  }
  componentDidMount() {
    window.onresize = () => {
      this.setState({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
  }
  render() {
    return (
      <div className="text-4xl">
        {this.props.state.game && this.props.showPolicyStatus ? (
          <div>
            <PolicyStatus game={this.props.state.game} />
          </div>
        ) : null}
        {this.props.renderContent
          ? this.props.renderContent({ width: this.state.width, height: this.state.height })
          : null}
        {this.props.state.isDebug ? (
          <div>
            <pre>{JSON.stringify(this.props.state.game, null, 2)}</pre>
          </div>
        ) : null}
        <style global jsx>{`
          body {
            margin: 0;
          }
        `}</style>
      </div>
    );
  }
}

function checkIsMobile() {
  var ua = navigator.userAgent;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i.test(
    ua
  );
}

function getRoleMessage(me, game: Game) {
  const isHitler = game.hitler === (me && me.id);
  const isFacist = me && me.role === 'fascist';
  const fascists = game.players.filter(
    player => player.role === 'fascist' && player.id !== (me && me.id)
  );
  if (isHitler) {
    if (game.players.length <= 6) {
      return (
        <div>
          You're Hitler! The other facists are:
          {fascists.map(f => (
            <PlayerLabel>{f.name}</PlayerLabel>
          ))}
        </div>
      );
    } else {
      return (
        <div>
          You're Hitler! Because this game has 7 or more players, you'll have to guess who the other
          fascists are.
        </div>
      );
    }
  }

  if (isFacist) {
    const withoutHitler = fascists.filter(fascist => fascist.id !== game.hitler);
    const hitler = fascists.filter(fascist => fascist.id === game.hitler)[0];
    if (withoutHitler.length > 0) {
      return (
        <div>
          You're a facist. The other facists are:{' '}
          {withoutHitler.map(f => (
            <PlayerLabel>{f.name}</PlayerLabel>
          ))}{' '}
          and Hitler is <PlayerLabel>{hitler.name}</PlayerLabel>
        </div>
      );
    } else {
      return (
        <div>
          You're a facist. Hitler is <PlayerLabel>{hitler.name}</PlayerLabel>
        </div>
      );
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

const canJoin = ({ game }) => game && game.isStarted === false && game.players.length <= 10;
const canStart = ({ game }) => game && game.isStarted === false && game.players.length >= 5;
const isObserver = ({ game, playerId }: State) =>
  game && game.isStarted && !game.players.find(player => player.id === playerId);

const canStartMessage = ({ game }) => {
  if (canStart({ game })) {
    return `We have enough players to begin but a few more can't hurt`;
  }
  const players = ((game && game.players) || []).length;
  const needed = 5 - players;
  return `Still looking for ${needed} more player${needed > 1 ? 's' : ''}`;
};

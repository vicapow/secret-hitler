To run the game locally

```
yarn dev
```

This will start a server running at http://localhost:3000

Open ths URL from a desktop as to simulate the "board" or "TV" view.

To open a user app or "hand" version, use the paramets `isHand=true` plus the playerId to override to simulate other others.

http://localhost:3000/?isHand=true&playerId=1

Before the game can start, you'll need to repeat this process for the other 4 players.

Note: Because of a limitation on Next.JS you'll need to limit the number of open "hand" windows to one. Just reload the URL to jump between players.


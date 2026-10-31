# Architecture

```
React client ── REST + Socket.IO ── Express API ── MongoDB
                                       │
                                       ├── services/auctionRules.js      pure rules, no I/O
                                       ├── services/bidding.service.js   bids, buying, settlement
                                       ├── services/fairPlay.js          shill-bidding signals
                                       ├── services/notification.service.js
                                       └── jobs/settleAuctions.js        5-second worker
```

## Design decisions

**Rules are pure functions.** `auctionRules.js` touches no database or socket, so proxy stepping, Vickrey pricing and the Dutch schedule can be tested directly. REST and Socket.IO both call the same `placeBid`, so there is one bidding path.

**Concurrency uses compare-and-swap.** Every accepted bid must match the `bidSeq` it read, and increments it. If another bid got in first, the service re-reads and re-decides, up to 5 times. This is why two buyers accepting one Dutch lot produce exactly one winner. `bidSeq` is used rather than price because a proxy war or a raised limit can change state without the price moving in the expected way.

**Secrets stay out of queries.** `proxyBids` and `sealedBids` are `select: false`, and `toPublicAuction` strips them and the reserve from every response and broadcast. A viewer sees only their own limit or sealed bid, and only the seller sees the reserve.

**Settlement is idempotent.** The worker and the page-load fallback can both call `settleAuction`. The `settledAt: null` guard lets only one succeed, so notifications go out once.

## Proxy bidding

Each bidder has one ceiling in `proxyBids`; a plain bid is a ceiling equal to its amount. For an incoming bid with ceiling C against the best rival ceiling R:

- **C is above R:** the bidder leads at `max(amount, min(C, R + step))`.
- **C is at or below R:** the rival keeps the lead at `min(R, C + step)`. Earlier bidders win ties.
- **A ceiling at or above the reserve** jumps the price straight to the reserve.

## Data additions

| Model | Fields |
|---|---|
| `Product` | `format`, `reservePrice`, `buyNowPrice`, `dutchFloor`, `dutchDropAmount`, `dutchDropMinutes`, `highBidder`, `proxyBids`, `sealedBids`, `sealedBidCount`, `bidSeq`, `extensions`, `endingSoonSent`, `settledAt`, `outcome` |
| `Bid` (embedded) | `isAuto` |
| `User` | `watchlist` |
| `Notification` | `user`, `type`, `message`, `auction`, `read`, `createdAt` (deleted after 60 days) |

## API additions

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/auction?q&category&format&sort` | Search and filter |
| `POST` | `/auction/:id/bid` | Bid, with optional `maxBid` |
| `POST` | `/auction/:id/buy` | Buy Now, or accept a Dutch price |
| `POST` | `/auction/:id/watch` | Toggle watchlist |
| `GET` | `/auction/watchlist` | Watched auctions |
| `GET`, `PATCH` | `/notifications`, `/notifications/read` | Read and clear alerts |
| `GET` | `/admin/fair-play` | Fair Play report (admin) |

## Socket events

| Event | Direction | Purpose |
|---|---|---|
| `auction:join`, `auction:leave` | Client to server | Enter or leave a lot's room |
| `auction:bid` | Client to server | Place a bid |
| `auction:bidPlaced` | Server to room | Public auction state after a bid |
| `auction:settled` | Server to room | Final result |
| `auction:userJoined`, `auction:userLeft` | Server to room | Presence |
| `notification:new` | Server to `user:<id>` room | Personal alert |

## Fair Play signals

| Signal | Trigger | Severity |
|---|---|---|
| Repeat underbidder | Bid on 3 or more of one seller's closed lots, won none | High |
| Shared IP | Bidder has the seller's IP address (localhost ignored) | Medium |
| Price pusher | At least 5 bids and 60% of a lot's manual bids, then lost | Medium |
| Rapid fire | 4 or more bids under 10 seconds apart | Low |

Auto-bids are excluded, because the system placed them rather than the person. Flags are prompts for human review, not verdicts.

# Boli

**बोली: "the bid".** A real-time auction house with three auction formats, built on the MERN stack.

| Format | How the price works | Who wins |
|---|---|---|
| **English** | Rises through open bids, with optional auto-bid | Highest bidder when the clock ends |
| **Dutch** | Falls on a fixed schedule down to a floor | First person to accept |
| **Sealed (Vickrey)** | Hidden until the close | Highest bidder, who pays the second-highest amount |

![Boli landing page: "One auction house. Three ways to sell." with a panel showing how English, Dutch and sealed auctions set the price](screenshots/landing.png)

## Screenshots

All screenshots come from the local demo (`npm run demo`), so every name and lot is sample data.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="screenshots/auctions.png" alt="Auctions page with format filters, search, category and sort controls, and a grid of English, Dutch and sealed lots">
      <p><b>Browse auctions.</b> Filter by format and category, search, and sort. Every card shows its format and time left.</p>
    </td>
    <td width="50%" valign="top">
      <img src="screenshots/english-auction.png" alt="English auction for a 1978 HMT watch at Rs 4,200 with a price chart, countdown, bid box, auto-bid option and Buy Now button">
      <p><b>English auction.</b> Live price, countdown and price chart, with auto-bid up to a private limit and an optional Buy Now price.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="screenshots/dutch-auction.png" alt="Dutch auction for a brass Nataraja statue whose price has dropped from Rs 18,000 to Rs 17,250, with the next drop timer and an Accept button">
      <p><b>Dutch auction.</b> The price falls on a schedule towards a floor, and the first person to accept wins.</p>
    </td>
    <td width="50%" valign="top">
      <img src="screenshots/sealed-auction.png" alt="Sealed auction for a first-edition book showing the viewer's own sealed bid, a hidden bid history, and a verified seller with a 4.7 star rating">
      <p><b>Sealed auction.</b> Bids stay hidden until the close, and the winner pays the second-highest bid. The seller card shows a verified seller badge and rating.</p>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="screenshots/settled-auction.png" alt="Finished auction seen by its seller: final price, winner, a Download Report (CSV) button, and a form to rate the buyer next to the buyer's 5-star review">
      <p><b>After the sale.</b> The winner is announced, the seller can download the bid log as CSV, and buyer and seller rate each other.</p>
    </td>
    <td width="50%" valign="top">
      <img src="screenshots/fair-play.png" alt="Admin Fair Play Monitor listing a high-severity repeat underbidder flag and three medium price-pushing flags, with a Download Report (CSV) button">
      <p><b>Fair Play monitor (admin).</b> Flags possible shill bidding, such as a bidder who always bids on one seller and never wins, and exports a settlement report.</p>
    </td>
  </tr>
</table>

<p align="center">
  <img src="screenshots/mobile.png" width="280" alt="The English auction page on a phone screen, with the item image and price chart stacked in one column">
  <br>
  <em>Works on phones too.</em>
</p>

## Features

- **Proxy bidding:** set a private limit and the server bids one step at a time for you.
- **Anti-sniping:** a bid in the last 2 minutes extends the auction (up to 15 times).
- **Hidden reserve and Buy Now:** sellers set a floor that bidders never see, or an instant-win price.
- **Automatic settlement:** a background worker closes auctions on time and picks the winner, without anyone having to open the page.
- **Fair Play monitor:** an admin report of shill-bidding signals: repeat underbidders, price pushers, shared IPs and machine-speed bidding.
- **Watchlist and live notifications:** outbid, won, sold and closing-soon alerts pushed over Socket.IO.
- **Scaled bid steps:** Rs 10 on small lots up to Rs 1,000 on large ones.
- **Server-side search:** full-text search, category and format filters, and sorting.
- **Price chart:** the price history of each lot.

## Run it locally

You need Node.js 20 or newer. MongoDB and API keys are not needed for the demo.

```bash
# Terminal 1: API with an in-memory database and sample data
cd server
npm install
npm run demo

# Terminal 2: web client
cd client
npm install
npm run dev
```

Open http://localhost:5173 and log in with password `demo1234` as `asha@demo.test`, `rohan@demo.test`, `meera@demo.test`, `kabir@demo.test`, `vikram@demo.test` or `admin@demo.test`. Open two browsers with different users to watch bids arrive live.

The first run downloads a MongoDB binary (around 100 MB). Demo data disappears when the server stops.

## Tests

```bash
cd server
npm test
```

The tests cover the pure auction rules and run the bidding service against a real in-memory MongoDB, including 20 simultaneous bids and two buyers racing to accept the same Dutch lot.

## Deploying

The client needs `VITE_API` set to the API URL. The server needs `MONGO_URL`, `JWT_SECRET` and `ORIGIN`, plus these optional variables: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `CONTACT_EMAIL` and `MAIL_FROM`. Without Cloudinary keys, new listings use a placeholder image. Without the three email settings, the contact form says it is unavailable.

Host the API on a long-running Node server (`npm start`), such as Render or Railway. Socket.IO and the settlement worker do not run on serverless hosts like Vercel.

## How it fits together

See [ARCHITECTURE.md](ARCHITECTURE.md).

## Credits and license

Boli started from the open-source [Auction Management System](https://github.com/unnati-joshi/Auction-Management-System), which carries an MIT license by Avnish Kumar. The login, profile, legal pages and base app structure come from that project. The original copyright notice is kept in [LICENSE](LICENSE), as the license requires.

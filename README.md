
# Auction Management System

A full-stack, real-time auction platform that enables users to create auctions, place bids, track auction activity, and manage listings through an interactive web interface.

Built with the MERN stack, the application combines real-time communication, secure authentication, and transactional database operations to support consistent auction workflows.

## Features

- **Real-Time Bidding:** Uses Socket.io to broadcast bid updates and auction activity to connected clients.
- **Concurrent Bid Handling:** Uses MongoDB transactions to maintain consistency when multiple users attempt to bid on the same auction.
- **Authentication & Authorization:** Implements JWT-based authentication with HTTP-only cookies for session security.
- **Auction Management:** Supports auction listing workflows and bid placement.
- **Image Uploads:** Integrates Cloudinary for auction image storage and delivery.
- **Email Notifications:** Uses Resend for application emails and relevant auction updates.
- **Efficient Data Fetching:** Uses TanStack Query (React Query) for server-state management, caching, and query invalidation.
- **Admin Dashboard:** Provides an administrative interface for managing auction-related data and operations.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| Real-Time Communication | Socket.io |
| Authentication | JWT, HTTP-only cookies |
| Image Storage | Cloudinary |
| Email Service | Resend |
| Server-State Management | TanStack Query |
| Deployment | Vercel, Render |

## Architecture

```text
                 React Frontend
                       |
             REST API / Socket.io
                       |
                Express Server
                 /           \
        Authentication    Auction Services
              |                  |
          JWT Cookies      Bid Validation
                                 |
                        MongoDB Transactions
                                 |
                       Consistent Bid Updates

External Services:
  Cloudinary -> Image Storage
  Resend     -> Email Delivery
```

## How It Works

### 1. Authentication

Users authenticate through the application, with JWT-based authentication and HTTP-only cookies used to protect authenticated routes. The backend verifies the user's identity and authorization before allowing protected operations.

### 2. Auction Creation

Users create auction listings with the relevant details and images. Images are uploaded to Cloudinary, while auction metadata is stored in MongoDB.

### 3. Bid Placement

When a user places a bid, the backend validates the request and checks the current auction state and bidding constraints before updating the auction.

### 4. Concurrent Bid Handling

Multiple users may attempt to bid on the same auction simultaneously. Database transactions help ensure that related database operations are committed consistently or rolled back on failure.

The backend must validate the latest auction state within the transaction and handle transaction conflicts or retries appropriately. Socket.io then communicates accepted bid updates to connected clients.

### 5. Real-Time Updates

Socket.io enables the server to broadcast relevant auction events to connected users, reducing the need for clients to repeatedly poll the backend for updates.

### 6. Data Fetching and Caching

TanStack Query manages server-state fetching and caching on the frontend. Queries can be invalidated or refreshed after successful mutations to keep displayed auction information synchronized with backend state.

## Environment Variables

Create a `.env` file in the backend directory and configure the variables required by your implementation.

```env
PORT=5000
MONGODB_URI=
JWT_SECRET=
CLIENT_URL=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

RESEND_API_KEY=
```

Use the actual variable names expected by your application. Never commit credentials, API keys, or production secrets to version control.

## Getting Started

### Prerequisites

- Node.js and npm
- MongoDB instance
- Cloudinary account, if image uploads are enabled
- Resend API key, if email functionality is enabled

### Installation

Clone the repository:

```bash
git clone https://github.com/unnati-joshi/Auction-Management-System.git
cd Auction-Management-System
```

Install dependencies in the frontend and backend directories, using the directory names in your repository:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Configure the environment variables and start the development servers using the scripts defined in each `package.json`.

For example, if both projects define a `dev` script:

```bash
npm run dev
```

Run this command separately in each directory.

## Engineering Highlights

- Designed REST APIs for auction and bidding workflows.
- Integrated Socket.io for event-driven, real-time client updates.
- Used MongoDB transactions to support consistent database updates during concurrent bidding.
- Implemented JWT authentication using HTTP-only cookies.
- Integrated external services for image storage and email delivery.
- Managed frontend server state with TanStack Query.

## Future Improvements

- Add automated tests for simultaneous bidding and transaction conflicts.
- Introduce rate limiting and stronger abuse prevention for bidding endpoints.
- Add auction expiration jobs and reliable winner finalization.
- Implement observability, structured logging, and performance monitoring.
- Add pagination and indexing for large auction collections.

## Author

**Unnati Joshi**

- GitHub: [unnati-joshi](https://github.com/unnati-joshi)
- LinkedIn: [unnatijoshii](https://linkedin.com/in/unnatijoshii/)

---

*Built as a full-stack project to explore real-time applications, backend API design, authentication, and database consistency.*

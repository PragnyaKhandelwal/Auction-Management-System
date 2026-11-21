# Contributing Guidelines

Hi there!
Thanks for showing interest in contributing to **Boli**, a real-time auction house with English, Dutch and sealed-bid auctions. We welcome all kinds of contributions — code, design, documentation, or suggestions.

Please also read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Project Tech Stack

- Frontend: React 19 + Redux Toolkit + Tailwind CSS v4
- Backend: Node.js + Express 5 + MongoDB
- Real-time: Socket.io (live bidding)
- State Management: Redux Toolkit (auth) + TanStack React Query (server state)
- Routing: React Router v7+
- API Handling: Centralized Axios instance (`src/services/`) + Custom hooks (`src/hooks/`)
- Authentication: JWT with `httpOnly` cookies
- Testing: Node's built-in test runner + `mongodb-memory-server` (server)
- CI: GitHub Actions runs the server tests and a client build on every pull request
- Deployment: API and settlement worker on Render, client on Vercel, database on MongoDB Atlas (see the [README](README.md#deploying))

---

## Architecture Overview

### Backend Pattern

```
Route → Controller → Service/Model → Response
```

- **Routes** (`server/routes/`): Define endpoints, apply middleware
- **Controllers** (`server/controllers/`): Handle request/response logic
- **Models** (`server/models/`): Mongoose schemas
- **Middleware** (`server/middleware/`): Auth guards, file upload
- **Services** (`server/services/`): External service integrations (Cloudinary)
- **Socket** (`server/socket/`): Real-time event handlers
- **Utils** (`server/utils/`): Reusable utility functions

### Frontend Pattern

```
Page → Hook (useQuery/useMutation) → Service (axios) → API
```

- **Services** (`client/src/services/`): Centralized API calls using shared axios instance
- **Hooks** (`client/src/hooks/`): React Query wrappers for data fetching and mutations
- **Pages** (`client/src/pages/`): Page components that consume hooks
- **Components** (`client/src/components/`): Reusable UI components
- **Store** (`client/src/store/`): Redux slices for global state (auth)

> **Important**: New API calls should use services (`src/services/`) with the centralized `api` instance, NOT direct axios imports. Wrap them with React Query hooks in `src/hooks/`.

---

## How to Contribute

### 1. Fork the Repository

Click on the **Fork** button (top-right) and create your own copy.

### 2. Clone the Repo

```bash
git clone https://github.com/your-username/Auction-Management-System.git
cd Auction-Management-System

# Keep your fork up to date with the main project
git remote add upstream https://github.com/PragnyaKhandelwal/Auction-Management-System.git
git pull upstream main
```

### 3. Setup Project Locally

- Install frontend and backend dependencies:

```bash
# Frontend
cd client
npm install

# Backend
cd ../server
npm install
```

- The quickest way to run everything is the **demo**, which needs no MongoDB, `.env` file or API keys. It starts the API with an in-memory database and sample users and lots:

```bash
# Terminal 1
cd server
npm run demo

# Terminal 2
cd client
npm run dev
```

Open http://localhost:5173 and log in as `asha@demo.test` (or `rohan`, `meera`, `kabir`, `vikram`, `admin`) with the password `demo1234`.

- To work against a real database instead, create `server/.env` with `MONGO_URL`, `JWT_SECRET` and `ORIGIN`, then run `npm run dev`. The README lists every optional variable.

### 4. Create a New Branch

```bash
git checkout -b feature/your-feature-name
```

### 5. Make Your Changes

Follow existing code structure and patterns:

- **ES Modules** (`import`/`export`) everywhere
- **Controller pattern** for API handlers: `async (req, res) => { try {} catch {} }`
- **Service + Hook pattern** for frontend API calls
- **Socket handlers** in `server/socket/` for real-time features

### 6. Test Your Changes

Run the same checks that CI runs on every pull request, and make sure both pass:

```bash
# Server tests (no database or network needed)
cd server
npm test

# Client build
cd ../client
npm run build
```

Add tests to `server/test/` for new server behaviour. Database tests use `mongodb-memory-server`; see the existing tests for the pattern.

### 7. Commit Your Changes

Use conventional commit messages:

```bash
git add .
git commit -m "feat: add live notification for bid updates"
```

Common prefixes: `feat:`, `fix:`, `docs:`, `refactor:`, `style:`, `test:`, `chore:`

### 8. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request against `main` on GitHub:

- Fill in the pull request template, including how you tested the change.
- Link the issue it resolves with `Closes #<issue number>`, so the issue closes when the PR is merged.
- Wait for the CI checks (server tests on Node 20 and 22, and the client build) to pass.
- Never push directly to `main`.

---

## Code Style Guidelines

- Use **ES Modules** (`import`/`export`) — no `require()`
- Use consistent 2-space indentation
- Use `const` by default, `let` when reassignment is needed
- Async/await for all asynchronous code
- Proper error handling in every controller and service
- Descriptive variable and function names
- Clear commit messages using conventional commits

---

## Areas for Contribution

- **Bug Fixes** - Help identify and fix issues
- **New Features** - Implement upcoming features from the roadmap
- **Documentation** - Improve README, code comments, JSDoc
- **UI/UX** - Enhance user interface and experience
- **Security** - Strengthen security measures
- **Performance** - Optimize queries, reduce bundle size
- **Testing** - Add unit and integration tests
- **Accessibility** - Improve WCAG compliance

---

## Need Help?

Feel free to open an issue for doubts, questions, or suggestions.
Let's make this project better together!

---

Boli builds on the open-source Online Auction System by Avnish Kumar, used under the MIT license. See [LICENSE](LICENSE).

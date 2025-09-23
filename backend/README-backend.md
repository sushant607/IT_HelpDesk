# Backend for SIH Unpaid Labours

## Setup
1. Copy `.env.example` to `.env` and set `MONGO_URI` and `JWT_SECRET`.
2. `cd backend`
3. `npm install`
4. `npm run dev` (requires nodemon) or `npm start`

## API
- `POST /api/auth/register` {name,email,password,role}
- `POST /api/auth/login` {email,password}
- `GET /api/users/me` (auth)
- `GET /api/tickets` (auth) - supports ?mine=true&status=&priority=
- `POST /api/tickets` (auth) - create
- `GET /api/tickets/:id` (auth)
- `PUT /api/tickets/:id` (auth) - update
- `POST /api/tickets/:id/comments` (auth) - add comment
- `DELETE /api/tickets/:id` (auth)
- `POST /api/chatbot` (auth) - {message}
- `GET /api/notifications` (auth)

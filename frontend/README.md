# Abonasi Frontend MVP (D12-FE-1) — Bootstrap

## Requirements
- Node.js 18+ (recommended 20+)

## Setup
```bash
cd frontend
npm install
npm run dev
```

## Configure API base URL
By default, the app uses `http://localhost:3001`.

To override:
1) create `frontend/.env.local`
2) add:
```bash
VITE_API_BASE_URL=http://localhost:3001
```

## Notes
- Success responses are expected as `{ data: ... }`
- Error responses are expected as `{ error, message }`

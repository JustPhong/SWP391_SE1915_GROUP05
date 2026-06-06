# Parking Building Management System

A full-stack parking management system for a multi-floor parking building. Built for an academic group project.

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **ORM:** Prisma
- **Database:** Microsoft SQL Server

## Prerequisites

- Node.js 18+
- Microsoft SQL Server (local or containerized)
- npm or yarn

## Project Structure

```
parking-system/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── dtos/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       ├── utils/
│       └── server.ts
└── frontend/
    └── src/
        ├── components/
        ├── context/
        ├── hooks/
        ├── pages/
        ├── services/
        ├── types/
        └── utils/
```

## Setup

### 1. Clone & Install Dependencies

```bash
cd parking-system

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Database

Copy the example env file and update with your SQL Server connection string:

```bash
# Backend
cd backend
cp .env.example .env
```

Edit `.env` and set your `DATABASE_URL`:

```
DATABASE_URL="sqlserver://localhost:1433;database=parking_system;user=sa;password=YourPassword;trustServerCertificate=true"
```

### 3. Run Database Migration

```bash
cd backend
npx prisma migrate dev --name init
```

### 4. Start Development Servers

**Backend** (port 3000):

```bash
cd backend
npm run dev
```

**Frontend** (port 5173):

```bash
cd frontend
npm run dev
```

## User Roles

| Role    | Description                          |
|---------|--------------------------------------|
| ADMIN   | System Administrator                 |
| MANAGER | Parking Manager                      |
| STAFF   | Parking Staff (check-in/check-out)   |
| DRIVER  | Parking User / Driver                |

## Key Features

1. **Check-in / Check-out** - Staff processes vehicle entry and exit
2. **Monthly Package** - Subscribers purchase recurring parking plans
3. **Reports & Statistics** - Manager views occupancy, revenue, and trends
4. **Slot Management** - Multi-floor layout with fixed and casual slots

# Acnerra — Collaborative Accountability

Acnerra is a collaborative accountability and goal-tracking web application designed to help partners stay productive together.

## Features

- **Authentication**: Secure login and registration.
- **Task Management**: Create, assign, and track tasks.
- **Accountability Partners**: 1:1 partnership for each task.
- **Check-ins**: Real-time or near real-time updates on progress.
- **Notifications**: Stay informed about invites and task updates.
- **Dashboard**: A bird's-eye view of your productivity.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Auth**: [Auth.js](https://authjs.dev/) (Planned)

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL instance

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/acnerra.git
   cd acnerra
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and provide your database connection string.

4. Initialize the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

## Project Structure

- `src/app`: Routes and pages.
- `src/components`: UI components.
- `src/lib`: Shared utilities and database clients.
- `src/services`: Business logic layer.
- `src/types`: TypeScript definitions.
- `prisma`: Database schema and migrations.

## License

MIT

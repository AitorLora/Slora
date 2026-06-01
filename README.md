# Slora Nautic

Fleet and reservation management system for maritime and motor rental businesses. Built with Next.js 16, React 19, TypeScript, and Supabase.

## Overview

Slora Nautic provides a comprehensive platform for managing:
- **Reservations**: Multi-asset booking system with conflict detection
- **Fleet Management**: Track boats and motorcycles with maintenance scheduling
- **Multi-Tenant**: Support for multiple societies/companies with role-based access control
- **Analytics**: KPI dashboard with revenue tracking and performance metrics

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js Server Actions, Server-Side Rendering
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with JWT
- **UI Components**: Custom Glassmorphism design

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Supabase account with a project created

## Getting Started

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd slora-nautic
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

You can find these values in your Supabase project settings under **API**.

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The app will automatically redirect to the login page. You can:
- Create a new account
- Use test credentials from your Supabase project

### 4. Build for Production

```bash
npm run build
npm run start
```

## Database Setup

The application expects the following Supabase tables:

- **perfiles**: User profiles with roles and society assignments
- **reservas**: Reservation records with pricing and state management
- **activos**: Fleet assets (boats/motorcycles) with maintenance tracking
- **sociedades**: Organization/company records for multi-tenancy

### Row-Level Security (RLS)

All tables have RLS policies enabled to enforce multi-tenant isolation. Ensure your Supabase project has RLS enabled on all tables.

## Architecture

### Authentication Flow

1. User logs in with email/password (Supabase Auth)
2. Session stored in HTTP-only cookies
3. Middleware validates session on protected routes
4. Role-based redirect (master → dashboard, investor → investor panel)

### Authorization

- **Master Role**: Full system access, can manage all societies
- **Investor Role**: Limited to their assigned society's data
- **Server-side Validation**: All mutations validated on the server with `.maybeSingle()` and explicit error handling

## Key Features

- **Conflict Detection**: Prevents double-booking of assets
- **Price Calculation**: Server-side pricing based on asset type and duration
- **RLS Security**: Multi-tenant data isolation at the database level
- **Error Handling**: Comprehensive validation and user-friendly error messages
- **Performance**: Automatic cache revalidation with Next.js `revalidatePath()`

## Development Notes

### Server Actions Best Practices

- Always validate user authorization before mutations
- Use `.maybeSingle()` instead of `.single()` for safer query handling
- Calculate sensitive values (pricing) on the server
- Validate dates and business logic server-side

### Debugging

Enable verbose logging:

```bash
DEBUG=* npm run dev
```

Check browser console for client-side errors and server logs for backend issues.

## Deployment

1. Ensure all environment variables are set in your hosting platform
2. Run `npm run build` to verify production build
3. Deploy to Vercel or your preferred hosting provider

## License

Proprietary — Slora Nautic © 2026

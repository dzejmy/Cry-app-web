# PeakPass

A modern booking and pass management platform for outdoor activities and mountain operators. Built with React, TypeScript, and Vite.

## Tech Stack

| Category | Library |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| Routing | React Router v6 |
| State management | Zustand |
| Validation | Zod |
| Backend / Auth | Supabase (`@supabase/supabase-js`) |
| Payments | Stripe (`@stripe/stripe-js`, `@stripe/react-stripe-js`) |
| Maps | Mapbox GL (`mapbox-gl`) |
| Internationalisation | i18next + react-i18next |
| Icons | Lucide React |
| Notifications | react-hot-toast |
| Date utilities | date-fns |

## Prerequisites

- Node.js 18+
- npm 9+
- A [Supabase](https://supabase.com) project
- A [Stripe](https://stripe.com) account (publishable key)
- A [Mapbox](https://mapbox.com) account (public token)

## Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd peakpass

# 2. Copy environment variables and fill in your keys
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous (public) key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_...`) |
| `VITE_MAPBOX_TOKEN` | Mapbox public access token |

## Folder Structure

```
src/
├── assets/             Static assets (images, SVGs)
├── components/
│   ├── ui/             Generic, reusable UI primitives (buttons, inputs, modals…)
│   ├── layout/         Page shell components (header, sidebar, footer…)
│   ├── booking/        Booking-flow specific components
│   └── operator/       Operator dashboard components
├── pages/
│   ├── booking/        Public booking pages
│   ├── customer/       Customer account & history pages
│   ├── operator/       Operator management pages
│   ├── auth/           Login / register / password reset
│   └── admin/          Platform admin pages
├── lib/
│   └── supabase/       Supabase client initialisation & helpers
├── hooks/              Custom React hooks
├── store/              Zustand stores
├── types/              Shared TypeScript types & interfaces
└── utils/              Pure utility functions
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

# Overview

This is a Spotify Playlist Generator application that uses AI to create personalized playlists based on user descriptions. The app allows users to describe their music preferences in natural language, then generates playlists using AI analysis and Spotify's Web API. Users can also schedule automatic playlist generation and receive notifications when new playlists are created.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system inspired by Spotify's aesthetic
- **State Management**: TanStack Query for server state and React's built-in state for local UI state
- **Routing**: Wouter for client-side routing
- **Theme**: Dark/light mode support with CSS custom properties

## Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints under `/api` prefix
- **Error Handling**: Centralized error middleware with structured error responses
- **Development**: Hot reloading with Vite middleware integration

## Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Connection**: Neon Database serverless PostgreSQL
- **Schema**: Three main entities - users, schedules, and generated playlists
- **Fallback**: In-memory storage implementation for development/testing

## Authentication & Authorization
- **Spotify Integration**: OAuth flow using Spotify Web API SDK
- **Token Management**: Automatic refresh token handling for expired access tokens
- **Session Storage**: PostgreSQL-based session store using connect-pg-simple

## AI Integration
- **Provider**: OpenAI GPT-5 for music preference analysis
- **Functionality**: Converts natural language descriptions into structured playlist preferences
- **Fallback**: Mock track generation when external APIs are unavailable

# External Dependencies

## Third-Party Services
- **Spotify Web API**: Core music data, search, and playlist creation functionality
- **OpenAI API**: AI-powered music preference analysis and recommendation
- **Neon Database**: Managed PostgreSQL hosting

## Key Libraries
- **@spotify/web-api-ts-sdk**: Official Spotify Web API integration
- **@neondatabase/serverless**: Serverless PostgreSQL client
- **drizzle-orm**: TypeScript ORM for database operations
- **@tanstack/react-query**: Server state management and caching
- **@radix-ui/react-***: Accessible UI component primitives
- **tailwindcss**: Utility-first CSS framework

## Development Tools
- **Vite**: Fast build tool and development server
- **TypeScript**: Static type checking
- **tsx**: TypeScript execution for development
- **esbuild**: Fast bundling for production builds

## Browser APIs
- **Service Workers**: Background task handling and push notifications
- **Web Notifications**: User notifications for scheduled playlist generation
- **Local Storage**: Theme preferences and user settings persistence
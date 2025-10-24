# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude agents

Claude agents are stored in the following directory:
C:\Users\user\.claude\agents

## Project Overview

This is a Next.js 16 application using React 19, TypeScript, and TailwindCSS v4. The project uses the App Router architecture.

### Monster Battle Game

This is a demo application where:
- Monster PNG images appear in the middle of the screen
- Users must click a certain number of times to "defeat" each monster
- Defeated monsters drop "loot" in the form of NFTs
- Collected loot/NFTs are stored and displayed in an inventory page

**Current Implementation Status:**
- ✅ Basic clickable battle interface (HomePage component)
- ⏳ Monster system with health/defeat mechanics
- ⏳ NFT/loot drop system
- ⏳ Inventory page to view collected NFTs

## Build and Development Commands

```bash
# Start development server (with webpack bundler)
npm run dev

# Production build (with webpack bundler)
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

Note: This project explicitly uses webpack bundler (not Turbopack) via the `--webpack` flag.

## Architecture

### Framework Configuration

- **Next.js 16**: Uses App Router (not Pages Router)
- **React 19**: Latest version with new features
- **TypeScript**: Strict mode enabled with `jsx: "react-jsx"` transform
- **Module Resolution**: Uses `bundler` mode with path alias `@/*` mapping to `./src/*`

### Directory Structure

- `src/`: src directory
  - `app/`: App Router-
    - `api/`: API routes
    - `layout.tsx`: Root layout with Geist font configuration
    - `page.tsx`: Homepage component
    - `globals.css`: Global styles and TailwindCSS imports
  - `components/`: Page components
  - `lib/`: mongoDB
  - `hooks/`: Hook functions
  - `utils/`: Utilities
- `public/`: Static assets

### Styling

- **TailwindCSS v4**: Configured via PostCSS with `@tailwindcss/postcss` plugin
- Global styles include light/dark mode support with `dark:` variants
- Geist and Geist Mono fonts loaded via `next/font/google`

### TypeScript Configuration

- Path aliases: `@/*` resolves to `./src/*`
- Target: ES2017
- Strict mode enabled
- JSX transform: Uses new automatic runtime (`react-jsx`)

### Linting

ESLint configured with:
- `eslint-config-next/core-web-vitals`
- `eslint-config-next/typescript`
- Custom ignores for `.next/`, `out/`, `build/`, and `next-env.d.ts`

## Important Implementation Notes

### Webpack Configuration

This project is configured to use webpack bundler explicitly. When running dev or build commands, the `--webpack` flag is required (already configured in package.json scripts).

### Dark Mode

The application supports dark mode via Tailwind's `dark:` variant. Components use `dark:` classes for dark mode styling.

### Image Optimization

Use Next.js `<Image>` component from `next/image` for optimized image loading. The template demonstrates this with SVG logos using the `dark:invert` utility.

### Creating new pages

When creating a new page within the Nextjs project, use the proper folder and page.tsx file naming for the App Router. Leave the page.tsx for a new page as bare bones as possible, only referencing a component like `<HomePage />`. The component should be created in the components folder, with all the actual html and code for the page.
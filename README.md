# wikistr

A modern, decentralized, Nostr-based wiki client built with Svelte 5, TailwindCSS, and Vite.

## 🚀 Key Highlights & Features

- **Decentralized Wiki Articles (Kind 30818)**: Read, write, and version wiki content stored directly on Nostr relays.
- **Interactive Multi-Column Layout**: Browse content using a side-by-side deck system. Open search results, article pages, settings, and editors in parallel panels.
- **Relay Configuration & Outbox Support**:
  - Configure custom read/write relays.
  - Automatically merges default fallback relays with the user's personal Nostr relay lists (Kind 10002) for robust publishing.
  - Fetches from followed authors' relays to discover related articles.
- **Patches & Suggestions (Kind 1617)**: Propose edits to articles authored by others via Git-like patch events.
- **Private Tags & Bookmarks (Kind 30003)**: Categorize, tag, and bookmark articles privately, with cross-device synchronization encrypted via NIP-04.
- **Local History & Pinning**: Keep track of recently viewed articles and pin favorites to the dashboard dashboard.
- **Svelte 5 Powered**: Engineered with the latest Svelte 5 reactive Runes (`$state`, `$derived`, `$effect`) for responsive UI state management.

---

## 🛠️ Tech Stack

- **Framework**: [Svelte 5](https://svelte.dev/) & [SvelteKit](https://kit.svelte.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Nostr Libraries**: `@nostr/tools` & `@nostr/gadgets`
- **Storage**: IndexedDB (`idb-keyval`) & LocalStorage

---

## ⚙️ Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`.

### Commands

- `npm run dev`: Starts the local dev server.
- `npm run build`: Builds the static site assets.
- `npx svelte-check`: Runs type-checks and diagnostics for Svelte files.

---

## 📄 License

This project is open-source. Refer to the repository metadata for details.

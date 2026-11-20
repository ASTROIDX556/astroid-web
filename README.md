# astroid-web

[![CI](https://github.com/ASTROIDX556/astroid-web/actions/workflows/ci.yml/badge.svg)](https://github.com/ASTROIDX556/astroid-web/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Stellar](https://img.shields.io/badge/Built%20on-Stellar-7C3AED)](https://stellar.org)
[![Drips Wave](https://img.shields.io/badge/Drips-Stellar%20Wave-blue)](https://www.drips.network/wave/stellar)

> Next.js dashboard — the **human control plane** of Astroid, the Financial Operating System for autonomous AI agents on Stellar. Built for the [Drips Stellar Wave Program](https://www.drips.network/wave/stellar).

`astroid-web` is the interface through which organizations govern their AI agents. Humans set budgets, define spending policies, approve high-value transactions, and audit every action — the AI agents operate within those constraints on-chain.

## Features

- **Agent management** — create, configure, and monitor AI agents with provider/model selection (Nvidia, OpenAI, Anthropic, Gemini, Ollama, Custom)
- **Wallet dashboard** — Stellar wallet balances, transaction history, and XDR signing
- **Transaction history filters** — combine asset, status (Success / Pending / Failed or an exact status), agent, a free-text search (memo, counterparty, hash, ...) and an inclusive date range; all active filters apply together and are kept in the URL. See `src/features/transactions/filterTransactions.ts` for the exact matching rules
- **Policy engine UI** — create spending rules and simulate them against proposed transactions in a keyboard-accessible, two-step simulation dialog with screen-reader announcements (see [Accessibility](#accessibility))
- **Approval workflows** — multi-party proposal review with approve/reject controls
- **Budget tracking** — department-level budgets with real-time consumption meters
- **AI assistant** — Nvidia NIM-powered chat with financial briefings and anomaly alerts
- **Audit log** — immutable log of every agent action and governance decision
- **Developer portal** — API keys and webhook management
- **Live / mock mode** — set `NEXT_PUBLIC_API_URL` to switch from local fixtures to the live API automatically

## Accessibility

Modals use the shared `Dialog` primitive (`src/components/ui/dialog.tsx`) and `useFocusTrap`:

- **Focus** moves into the dialog when it opens and returns to the control that opened it when it closes.
- **Tab / Shift+Tab** cycle only through the dialog's controls; focus cannot reach the page behind it. With nested overlays only the innermost one responds.
- **Escape** closes the top-most dialog.

The policy simulation dialog (**Simulate before commit** on a policy page) has two steps, *Transaction parameters* and *Simulation results*, shown in a step list whose current step is marked `aria-current="step"`. Opening it focuses the Amount field. Running a simulation moves focus to the results heading, and **Edit parameters** moves it back to the Amount field. Invalid fields are marked `aria-invalid`, linked to their error message, and focused. Two visually hidden live regions announce changes in the simulation's state:

| State | Live region | Example announcement |
| --- | --- | --- |
| In progress | `role="status"` (polite) | "Simulation in progress. Evaluating policy rules…" |
| Passed | `role="status"` (polite) | "Simulation passed. All 3 policy rules passed." |
| Blocked by a rule | `role="alert"` (assertive) | "Simulation failed. 1 policy rule blocked this transaction: Single Transaction Spend Ceiling." |
| Error | `role="alert"` (assertive) | "Simulation could not be completed. …" |

The transaction filter bar uses native, labelled `<input>` / `<select>` controls, so standard keyboard and screen-reader behaviour applies. Its result count ("Showing 3 of 8 transactions", "No transactions match the 2 active filters.") is announced politely as filters change.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Vanilla CSS + CSS variables |
| Data fetching | TanStack Query v5 |
| SDK | `@astroid/sdk` (internal monorepo) |
| Animation | CSS transitions + custom chameleon cursor |

## Quick Start

```bash
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL

npm run dev       # http://localhost:3001
```

> **No backend?** Leave `NEXT_PUBLIC_API_URL` empty and the app runs in mock mode — every screen renders realistic fixture data with simulated latency. No network calls are made.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes (prod) | Base URL of `astroid-api`, e.g. `https://api.example.com` |
| `NEXT_PUBLIC_API_VERSION` | No | API version prefix, defaults to `/api/v1` |

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server on `localhost:3001` |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Related Repositories

| Repo | Description |
|---|---|
| [astroid-api](https://github.com/ASTROIDX556/astroid-api) | NestJS backend |
| [astroid-contract](https://github.com/ASTROIDX556/astroid-contract) | Soroban smart contracts |
| [astroid-sdk](https://github.com/ASTROIDX556/astroid-sdk) | TypeScript SDK and React hooks |

## Maintainers

| Name | GitHub | Contact |
|---|---|---|
| Astroid Team | [@ASTROIDX556](https://github.com/ASTROIDX556) | Open an issue or discussion |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs require passing `build`, `typecheck`, and `lint`.

## Security

See [SECURITY.md](SECURITY.md) for the responsible disclosure policy.

## License

MIT — see [LICENSE](LICENSE).
Optimized frontend component render cycles to boost page load performance.
​Updated API endpoint routing configurations for seamless client communications.
​Enhanced inline code documentation across primary user interface modules.
​Corrected outdated build environment settings and package dependencies.
​Clarified integration test instructions for verifying frontend asset delivery.
Streamlined UI state management protocols to minimize unnecessary component rerenders.
​Updated client-side routing structures to ensure seamless navigation across pages.
​Expanded inline comments within core utility scripts to aid future development.
​Corrected deprecated package parameters in build configuration files.
​Clarified testing execution commands for running end-to-end web interface suites.
​Standardized UI notification structures and fallback display states.
Clarified local setup instructions for setting up developer environments.
​Standardized error messaging components and fallbacks across the web app.
​Enhanced security guidelines for cross-origin requests and token handling.
​Resolved formatting inconsistencies across project documentation files.
​Added step-by-step deployment instructions for hosting target environments.
​Updated web performance tracking parameters and diagnostic metrics.
Enhanced inline comments within custom UI components for improved clarity.
​Corrected outdated build environment settings and package definitions.
​Clarified testing procedures for validating cross-browser UI compatibility.
​Standardized modal and banner error displays across the web application.
​Reinforced security policies regarding local storage usage and session timers.
​Resolved layout and markdown structure issues in technical project documentation.
​Added step-by-step instructions for publishing production web application builds
​Updated web performance tracking parameters and diagnostic metrics.
​Added step-by-step instructions for publishing production web application builds
​Standardized UI notification structures and fallback display states.

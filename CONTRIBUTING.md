# Contributing to Astroid Web

Thanks for your interest in improving the frontend for Astroid — the Financial
Operating System for autonomous AI agents on Stellar. We develop in the open
and welcome issues, discussion, and pull requests.

## Getting started

```bash
git clone https://github.com/ASTROIDX556/astroid-web.git
cd astroid-web
npm install
npm run dev         # start the Next.js dev server
npm run typecheck   # strict TypeScript checking
npm run lint        # ESLint + Prettier
npm test            # Vitest unit suites (pure modules in src/lib and feature utils)
```

The web app is a **Next.js App Router** project using TypeScript, Tailwind CSS,
Framer Motion, TanStack Query, and Recharts. When `NEXT_PUBLIC_API_URL` is
unset the app runs against built-in mock data so every screen renders without a
backend.

## Ground rules

- **Strict TypeScript.** `strict` is on and `any` is banned. Prefer generics and precise types.
- **Design tokens.** Use the tokens defined in `src/styles/tokens.css` — never hard-code colors, radii, or spacing.
- **Component conventions.** Reusable primitives live in `components/`, feature-specific widgets in `features/`. Keep components focused and composable.
- **Conventional Commits.** `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, etc.
- **Accessibility.** WCAG AA minimum. Keyboard navigation, focus indicators, and screen reader labels are required.

## Pull request checklist

1. `npm run typecheck && npm run lint && npm test && npm run build` all pass.
2. New components use design tokens, not ad-hoc values.
3. Visual changes include a screenshot or recording in the PR description.
4. Cross-repo contracts (API response shapes, entity names) still match `astroid-api`.

## Branch strategy

`main` is always releasable. Use `feature/*` and `fix/*` branches and open PRs
against `main`. See the PRD (Document 3) for the full branching model.

By contributing you agree that your contributions are licensed under the MIT License.

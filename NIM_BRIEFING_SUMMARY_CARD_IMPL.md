# Nvidia NIM Briefing Summary Card

Issue #586 adds a dashboard-ready summary card for Nvidia NIM financial briefings.

## Files

| File | Purpose |
| --- | --- |
| `src/features/ai/NimBriefingSummaryCard.tsx` | Card component, markdown rendering, loading/empty/error states |
| `src/features/ai/NimBriefingSummaryCard.test.ts` | Static-render unit tests for markdown structures and states |
| `src/features/ai/index.ts` | Public export from the AI feature barrel |
| `package.json` | Registers the new test with `npm test` |

## Component API

```tsx
import { NimBriefingSummaryCard } from '@/features/ai';

<NimBriefingSummaryCard
  content={briefingMarkdown}
  loading={isFetching}
  error={fetchError}
  generatedAt="2026-11-27 09:00 UTC"
  onGenerate={() => openAssistant("Generate today's financial briefing.")}
/>;
```

| Prop | Type | Default | Behavior |
| --- | --- | --- | --- |
| `content` | `string \| null` | `undefined` | Raw Markdown from the NIM briefing endpoint |
| `loading` | `boolean` | `false` | Renders a labelled shimmer skeleton; hides content |
| `error` | `string \| null` | `null` | Renders a `role="alert"` failure state |
| `title` | `string` | `Financial briefing` | Visible card heading |
| `generatedAt` | `string \| null` | `undefined` | Preformatted API timestamp, shown below the body |
| `onGenerate` | `() => void` | `undefined` | Adds a retry/generate button to empty and error states |
| `className` | `string` | `undefined` | Extra card classes via `cn` |

State precedence: `loading` → `error` → empty response → markdown body.

## Markdown and safety

`content` is parsed with the existing dependency-free `@/lib/markdown` parser into a
typed AST, then emitted as React elements. Supported structures are headings
(`#`–`###`), ordered and unordered lists, paragraphs, bold/italic, inline code,
fenced code blocks, and `http:`/`https:`/`mailto:` links. There is no
`dangerouslySetInnerHTML`: raw HTML arrives as escaped text and unsafe link
protocols degrade to plain labels, so a model response cannot execute code.

## Tokens and accessibility

All colors resolve through `src/styles/tokens.css` via the Tailwind theme aliases
(`bg-surface`, `bg-gold-soft`, `border-gold/35`, `text-foreground-secondary`,
`text-gold-strong`). No hard-coded Tailwind color utilities are used. Body copy
uses `--text-secondary` on `--surface-primary`; accents use `--gold-strong` on
`--gold-soft`. These pairs clear WCAG AA in the light, dark, and high-contrast
themes without component-level overrides.

The card is a labelled `<section>` with `aria-busy` while loading; the skeleton
and empty state expose `role="status"`, failures expose `role="alert"`, and the
rendered body uses `aria-live="polite"`.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

Tests render the component with `react-dom/server` (no DOM harness required) and
assert heading/list/inline-code structures, inert handling of HTML and unsafe
links, token-based styling, the loading skeleton, the empty response, and the
error state.

## Screenshot note

This repository has no browser/screenshot automation in `npm test` or CI, and this
change is delivered as a commit rather than a pull request. A live UI screenshot
was therefore not captured; the static-render tests document the exact markup of
each state and can be used by a reviewer to reproduce the visual states locally
with `npm run dev`.

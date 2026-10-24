/**
 * Markdown formatting for AI assistant briefing messages (#173).
 *
 * Turns a ChatMessage — including its structured executive briefing payload —
 * into clean Markdown so operators can paste briefings straight into reports,
 * tickets, or chat tools for auditing.
 */

import type { ChatMessage } from './types';

const roleLabel = (role: ChatMessage['role']): string =>
  role === 'user' ? 'You' : role === 'system' ? 'System' : 'Assistant';

/** ISO timestamp → `2026-10-18 11:03 UTC`, safe for pasted reports. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date
    .toISOString()
    .slice(0, 16)
    .replace('T', ' ') + ' UTC';
}

/** Serialize one assistant/user message block as Markdown. */
export function chatMessageToMarkdown(message: ChatMessage): string {
  const lines: string[] = [
    `### ${roleLabel(message.role)} — ${formatTimestamp(message.timestamp)}`,
    '',
    message.content.trim(),
  ];

  const briefing = message.structuredBriefing;
  if (briefing) {
    lines.push(
      '',
      '#### Executive Summary',
      '',
      '| Metric | Value |',
      '| --- | --- |',
      `| Total daily spend | ${briefing.totalDailySpend.toLocaleString('en-US')} ${briefing.currency} |`,
      `| Active agents | ${briefing.activeAgentsCount} |`,
      `| Top spender | ${briefing.topSpenderAgent} |`,
      `| Low-balance wallets | ${briefing.lowBalanceWalletsCount} |`,
      '',
      `> **Recommendation:** ${briefing.recommendation}`,
    );
  }

  return lines.join('\n');
}

/** Serialize the full briefing transcript as Markdown. */
export function chatTranscriptToMarkdown(messages: ChatMessage[]): string {
  const header = [
    `## Astroid AI Assistant Briefing — ${formatTimestamp(new Date().toISOString())}`,
    '',
  ];
  return [...header, ...messages.map(chatMessageToMarkdown)].join('\n\n').trim() + '\n';
}

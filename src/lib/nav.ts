import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Bot,
  BrainCircuit,
  KeyRound,
  LayoutDashboard,
  PiggyBank,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Terminal,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Signature surfaces get a subtle gold marker in the rail. */
  signature?: boolean;
}

export interface NavSection {
  heading: string;
  items: NavItem[];
}

/**
 * Primary sidebar navigation (PRD Doc 9 — Overview, Wallets, Agents, Treasury,
 * Policies, Budgets, Analytics, Approvals, Notifications, Developers, Settings).
 * Grouped into editorial sections rather than a flat list.
 */
export const navSections: NavSection[] = [
  {
    heading: 'Command',
    items: [
      { label: 'Overview', href: '/overview', icon: LayoutDashboard },
      { label: 'Analytics', href: '/analytics', icon: BarChart3 },
      { label: 'Memory', href: '/memory', icon: BrainCircuit, signature: true },
    ],
  },
  {
    heading: 'Operate',
    items: [
      { label: 'Agents', href: '/agents', icon: Bot },
      { label: 'Wallets', href: '/wallets', icon: Wallet },
      { label: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
      { label: 'Approvals', href: '/approvals', icon: ShieldCheck },
      { label: 'Multi-Sig', href: '/multisig', icon: KeyRound },
    ],
  },
  {
    heading: 'Govern',
    items: [
      { label: 'Policies', href: '/policies', icon: Shield },
      { label: 'Budgets', href: '/budgets', icon: PiggyBank },
      { label: 'Multisig Signers', href: '/multisig', icon: Key, signature: true },
      { label: 'Audit Log', href: '/audit', icon: ScrollText },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      { label: 'Notifications', href: '/notifications', icon: Bell },
      { label: 'Developers', href: '/developers', icon: Terminal },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

/** Flattened list — used by the command palette and active-route matching. */
export const navItems: NavItem[] = navSections.flatMap((s) => s.items);

'use client';

import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  BrainCircuit,
  Bot,
  Network,
  Lock,
  Fingerprint,
  Coins,
  Database,
  Globe,
} from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import GlitterWrap from '@/components/effects/glitter-wrap';
import BlackHole from '@/components/effects/black-hole';
import { CursorZone } from '@/components/effects/user-cursor';

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen overflow-hidden bg-background selection:bg-gold/30"
    >
      {/* Global Background Grid */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5 [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      </div>

      {/* Navigation */}
      <CursorZone label="Navigate" color="#5B50D6" textColor="#FFFFFF">
        <nav className="md:px-12 lg:px-24 fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-border/50 bg-background/80 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-gradient text-white shadow-gold">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-display text-2xl font-bold tracking-tight">
              Astroid
            </span>
          </div>
          <div className="hidden items-center gap-8 text-sm font-medium text-foreground-secondary md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#governance" className="transition-colors hover:text-foreground">
              Governance
            </a>
            <a href="#security" className="transition-colors hover:text-foreground">
              Security
            </a>
            <Link
              href="/auth"
              className="rounded-button bg-foreground px-4 py-2 text-background transition-opacity hover:opacity-90"
            >
              Sign In
            </Link>
          </div>
        </nav>
      </CursorZone>

      {/* 1. HERO SECTION — with GlitterWrap starfield */}
      <CursorZone label="✦ Discover" color="#FFFFFF" textColor="#000000">
        <section className="pt-32 pb-24 relative z-10 flex min-h-[90vh] flex-col items-center justify-center px-6 text-center">
          {/* GlitterWrap starfield behind the hero content */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <GlitterWrap
              particleCount={600}
              color1="#ffffff"
              color2="#5B50D6"
              color3="#8B7FFF"
              speed={3}
              density={80}
              starSize={15}
              focalDepth={13}
              turbulence={1}
              brightness={60}
              glitterIntensity={4}
              trailAmount={95}
              reverse={false}
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Ambient glows */}
          <motion.div
            className="pointer-events-none absolute left-[20%] top-[20%] z-[1] h-[40%] w-[40%] rounded-full bg-indigo-500/10 blur-[120px]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="pointer-events-none absolute right-[15%] top-[40%] z-[1] h-[35%] w-[35%] rounded-full bg-gold/10 blur-[120px]"
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="py-1.5 relative z-10 mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 px-3 backdrop-blur-sm"
          >
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-gold" />
            <span className="text-xs font-medium uppercase tracking-widest text-foreground-secondary">
              Powered by Stellar Soroban
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 max-w-5xl font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl lg:text-8xl"
          >
            The Financial OS for <br />
            <span className="bg-gradient-to-r from-[#5B50D6] to-[#8B7FFF] bg-clip-text text-transparent">
              Autonomous AI.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 mt-8 max-w-2xl text-lg leading-relaxed text-foreground-secondary md:text-xl"
          >
            Equip your AI models with programmable wallets, strict spending policies,
            and transparent financial memory. Safe, secure, and entirely on-chain.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 relative z-10 flex flex-col items-center gap-4 sm:flex-row"
          >
            <Link
              href="/auth"
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-md bg-foreground px-8 py-4 text-lg font-medium text-background transition-transform hover:scale-105 active:scale-95"
            >
              <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-gold/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <span className="flex items-center gap-2">
                Launch Workspace
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-8 py-4 text-lg font-medium text-foreground transition-colors hover:bg-surface-secondary"
            >
              Explore Platform
            </a>
          </motion.div>
        </section>
      </CursorZone>

      {/* 2. FEATURES SECTION */}
      <CursorZone label="⚡ Features" color="#8B7FFF" textColor="#FFFFFF">
        <section
          id="features"
          className="py-32 md:px-12 lg:px-24 relative z-10 border-y border-border/50 bg-surface/30 px-6"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-20 text-center md:text-left">
              <h2 className="mb-6 font-display text-4xl font-semibold md:text-5xl">
                Unleash Agentic Capital
              </h2>
              <p className="max-w-2xl text-lg text-foreground-secondary">
                AI shouldn&apos;t just generate text—it should be able to execute
                financial decisions. Astroid provides the complete tooling required to
                give AI models their own wallets.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={Bot}
                title="Agent Registry"
                desc="Assign unique decentralized identities to every AI model in your organization. Track their individual lifespans and performance."
                delay={0}
              />
              <FeatureCard
                icon={Coins}
                title="Programmable Wallets"
                desc="Deploy stateful smart contract wallets mapped to your AI agents, allowing them to autonomously spend USDC and XLM."
                delay={0.1}
              />
              <FeatureCard
                icon={BrainCircuit}
                title="Financial Memory"
                desc="Every agent action, LLM prompt, and on-chain execution is permanently recorded. Never wonder why an AI moved money."
                delay={0.2}
              />
            </div>
          </div>
        </section>
      </CursorZone>

      {/* 3. GOVERNANCE SECTION */}
      <CursorZone label="🛡️ Governance" color="#D4AF37" textColor="#000000">
        <section id="governance" className="py-32 md:px-12 lg:px-24 relative z-10 px-6">
          <div className="gap-16 mx-auto flex max-w-7xl flex-col items-center lg:flex-row">
            <div className="flex-1 space-y-8">
              <div className="inline-flex items-center justify-center rounded-md bg-surface-secondary p-3 text-gold">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
                Strict Spending Policies & Human Approvals.
              </h2>
              <p className="text-lg leading-relaxed text-foreground-secondary">
                Giving AI access to capital is dangerous without guardrails.
                Astroid&apos;s Policy Engine allows you to define unbreakable
                mathematical rules before an agent can spend a dime.
              </p>
              <ul className="space-y-4 text-foreground-secondary">
                <li className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 text-gold">
                    <CheckIcon />
                  </div>
                  Enforce daily and monthly spending limits (Budgets).
                </li>
                <li className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 text-gold">
                    <CheckIcon />
                  </div>
                  Restrict payments to specific whitelisted addresses.
                </li>
                <li className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 text-gold">
                    <CheckIcon />
                  </div>
                  Require manual Human Approval for transactions over $1,000.
                </li>
              </ul>
            </div>
            <div className="relative w-full flex-1">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#5B50D6]/20 to-transparent blur-2xl" />
              <div className="relative rounded-2xl border border-border bg-surface p-8 shadow-2xl">
                <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
                  <span className="font-mono text-xs uppercase text-foreground-muted">
                    Policy Evaluation
                  </span>
                  <span className="rounded-full bg-success/20 px-2 py-1 text-[10px] font-bold uppercase text-success">
                    Approved
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                    <span className="text-sm font-medium">Daily Limit ($500)</span>
                    <span className="text-sm text-foreground-secondary">24% Used</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                    <span className="text-sm font-medium">Recipient Validation</span>
                    <span className="text-sm text-success">Verified Vendor</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border bg-background p-3">
                    <span className="text-sm font-medium">Risk Score</span>
                    <span className="text-sm text-gold">Low (0.12)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </CursorZone>

      {/* 4. SECURITY SECTION */}
      <CursorZone label="🔐 Security" color="#4F46E5" textColor="#FFFFFF">
        <section
          id="security"
          className="py-32 md:px-12 lg:px-24 relative z-10 border-y border-border/50 bg-surface-secondary/40 px-6"
        >
          <div className="gap-16 mx-auto flex max-w-7xl flex-col items-center lg:flex-row-reverse">
            <div className="flex-1 space-y-8">
              <div className="inline-flex items-center justify-center rounded-md bg-surface p-3 text-indigo-400">
                <Lock className="h-8 w-8" />
              </div>
              <h2 className="font-display text-4xl font-semibold leading-tight md:text-5xl">
                Cryptographically Secured by Soroban.
              </h2>
              <p className="text-lg leading-relaxed text-foreground-secondary">
                Astroid is fundamentally non-custodial. We never hold your private keys.
                Every financial action requires a signature from your hardware or
                browser wallet (like Freighter).
              </p>
              <div className="grid grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <Fingerprint className="h-5 w-5 text-indigo-400" />
                  <h4 className="font-medium text-foreground">Non-Custodial</h4>
                  <p className="text-sm text-foreground-secondary">
                    Keys stay on your device.
                  </p>
                </div>
                <div className="space-y-2">
                  <Database className="h-5 w-5 text-indigo-400" />
                  <h4 className="font-medium text-foreground">Immutable Ledger</h4>
                  <p className="text-sm text-foreground-secondary">
                    Audit trails powered by Stellar.
                  </p>
                </div>
                <div className="space-y-2">
                  <Network className="h-5 w-5 text-indigo-400" />
                  <h4 className="font-medium text-foreground">Decentralized</h4>
                  <p className="text-sm text-foreground-secondary">
                    No single point of failure.
                  </p>
                </div>
                <div className="space-y-2">
                  <Zap className="h-5 w-5 text-indigo-400" />
                  <h4 className="font-medium text-foreground">Sub-Second Finality</h4>
                  <p className="text-sm text-foreground-secondary">
                    Instant global settlements.
                  </p>
                </div>
              </div>
            </div>
            <div className="relative w-full flex-1">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-gold/20 to-transparent blur-2xl" />
              <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
                <div className="flex items-center gap-2 border-b border-border bg-surface-secondary px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-danger/80" />
                  <div className="h-3 w-3 rounded-full bg-gold/80" />
                  <div className="h-3 w-3 rounded-full bg-success/80" />
                </div>
                <div className="space-y-2 p-6 font-mono text-sm text-foreground-secondary">
                  <p>
                    <span className="text-indigo-400">fn</span>{' '}
                    <span className="text-gold">execute_transfer</span>(env: Env, agent:
                    Address) {'{'}
                  </p>
                  <p className="pl-4">agent.require_auth();</p>
                  <p className="pl-4">policy::validate(&env, agent, amount)?;</p>
                  <p className="pl-4">
                    token.transfer(&contract, &recipient, &amount);
                  </p>
                  <p>{'}'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </CursorZone>

      {/* 5. CTA SECTION — with BlackHole effect */}
      <CursorZone label="🚀 Launch" color="#FFFFFF" textColor="#000000">
        <section
          className="py-32 relative z-10 overflow-hidden px-6 text-center"
          style={{ minHeight: '70vh' }}
        >
          {/* BlackHole animation background */}
          <div className="absolute inset-0 z-0">
            <BlackHole
              particleCount={800}
              particleSize={4}
              colors={['#ffffff', '#8B7FFF', '#5B50D6']}
              outerRadius={85}
              tilt={25}
              tiltSideway={160}
              trail={50}
              orbitSpeed={3}
              pullSpeed={1}
              showCenter={true}
              centre={{ voidRadius: 35, voidX: 50, voidY: 50 }}
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          <div
            className="relative z-10 flex flex-col items-center justify-center"
            style={{ minHeight: '60vh' }}
          >
            <h2 className="mb-6 font-display text-4xl font-semibold text-white drop-shadow-2xl md:text-6xl">
              Ready to Build the Future?
            </h2>
            <p className="mb-12 mx-auto max-w-2xl text-xl text-white/70 drop-shadow-lg">
              Connect your Freighter wallet today and deploy your first autonomous
              financial agent in minutes.
            </p>

            <Link
              href="/auth"
              className="inline-flex items-center justify-center gap-3 rounded-md bg-gold px-10 py-5 text-xl font-bold text-background shadow-gold shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <Globe className="h-6 w-6" />
              Connect Freighter Wallet
            </Link>
          </div>
        </section>
      </CursorZone>

      {/* Footer */}
      <CursorZone label="Astroid ✦" color="#1a1a2e" textColor="#FFFFFF">
        <footer className="py-12 relative z-10 flex flex-col items-center justify-between border-t border-border/50 px-6 text-center md:flex-row md:text-left">
          <div className="mb-4 flex items-center gap-2 md:mb-0">
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="font-display font-semibold">Astroid Financial</span>
          </div>
          <div className="text-sm text-foreground-muted">
            © {new Date().getFullYear()} Astroid. Built on the Stellar Network.
          </div>
        </footer>
      </CursorZone>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  delay,
}: {
  icon: any;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-md border border-border bg-surface p-8 transition-colors hover:border-indigo-500/30"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="h-12 w-12 mb-6 inline-flex items-center justify-center rounded-md bg-surface-secondary text-indigo-400">
          <Icon className="h-6 w-6" />
        </div>
        <h3 className="mb-3 text-xl font-semibold">{title}</h3>
        <p className="leading-relaxed text-foreground-secondary">{desc}</p>
      </div>
    </motion.div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 3L4.5 8.5L2 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

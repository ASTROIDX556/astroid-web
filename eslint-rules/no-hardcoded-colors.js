/**
 * ESLint rule: no-hardcoded-colors
 *
 * Flags Tailwind utility classes that use hard-coded color names (e.g. `bg-blue-600`,
 * `text-red-500`, `text-white`) or arbitrary CSS values (`text-[#abc]`, `bg-[rgb(...)]`)
 * in JSX className strings. All colors must reference the design tokens defined in
 * src/styles/tokens.css and mapped in tailwind.config.ts.
 *
 * Allowed token-based classes (non-exhaustive examples):
 *   bg-gold / bg-surface / bg-background / bg-danger / bg-success / bg-warning / bg-info
 *   text-foreground / text-gold / text-danger / text-success / text-warning / text-info
 *   border-border / border-danger …
 *
 * Context-exempt patterns (canvas JS, inline styles computed at runtime) must be
 * suppressed with an eslint-disable-line comment when genuinely unavoidable.
 */

'use strict';

/** Tailwind color-scale prefixes that are NOT part of the design token system. */
const FORBIDDEN_PREFIXES = [
  'bg-blue-', 'bg-red-', 'bg-green-', 'bg-yellow-', 'bg-purple-', 'bg-pink-',
  'bg-orange-', 'bg-teal-', 'bg-cyan-', 'bg-indigo-', 'bg-violet-', 'bg-fuchsia-',
  'bg-rose-', 'bg-sky-', 'bg-emerald-', 'bg-lime-', 'bg-amber-', 'bg-zinc-',
  'bg-neutral-', 'bg-stone-', 'bg-slate-', 'bg-gray-',
  'text-blue-', 'text-red-', 'text-green-', 'text-yellow-', 'text-purple-', 'text-pink-',
  'text-orange-', 'text-teal-', 'text-cyan-', 'text-indigo-', 'text-violet-', 'text-fuchsia-',
  'text-rose-', 'text-sky-', 'text-emerald-', 'text-lime-', 'text-amber-', 'text-zinc-',
  'text-neutral-', 'text-stone-', 'text-slate-', 'text-gray-',
  'border-blue-', 'border-red-', 'border-green-', 'border-yellow-', 'border-purple-',
  'border-pink-', 'border-orange-', 'border-teal-', 'border-cyan-', 'border-indigo-',
  'border-violet-', 'border-fuchsia-', 'border-rose-', 'border-sky-', 'border-emerald-',
  'border-lime-', 'border-amber-', 'border-zinc-', 'border-neutral-', 'border-stone-',
  'border-slate-', 'border-gray-',
  'fill-blue-', 'fill-red-', 'fill-green-', 'stroke-blue-', 'stroke-red-',
];

/** Standalone literal color classes (not part of a scale) that bypass the token system. */
const FORBIDDEN_LITERALS = new Set(['text-white', 'text-black', 'bg-white', 'bg-black']);

/** Arbitrary-value patterns: text-[#abc], bg-[rgb(...)], border-[hsl(...)] etc. */
const ARBITRARY_HEX_RE = /(?:text|bg|border|fill|stroke|ring|shadow|outline)-\[#[0-9a-fA-F]/;
const ARBITRARY_COLOR_FN_RE = /(?:text|bg|border|fill|stroke|ring|shadow|outline)-\[(?:rgb|hsl|oklch|hwb|lch|lab)/;

function checkClassString(classValue, node, context) {
  const classes = classValue.split(/\s+/);
  for (const cls of classes) {
    if (!cls) continue;

    if (FORBIDDEN_LITERALS.has(cls)) {
      context.report({
        node,
        message: `Design token violation: '${cls}' is a hard-coded color. Use a token class (e.g. text-foreground, text-accent-foreground, bg-surface) from tailwind.config.ts.`,
      });
      continue;
    }

    if (ARBITRARY_HEX_RE.test(cls) || ARBITRARY_COLOR_FN_RE.test(cls)) {
      context.report({
        node,
        message: `Design token violation: '${cls}' is an arbitrary color value. Reference a CSS variable token via a named Tailwind class instead.`,
      });
      continue;
    }

    for (const prefix of FORBIDDEN_PREFIXES) {
      if (cls.startsWith(prefix)) {
        context.report({
          node,
          message: `Design token violation: '${cls}' uses a hard-coded Tailwind color scale. Replace with a semantic token class (bg-gold, bg-danger, text-foreground-secondary, etc.) mapped in tailwind.config.ts.`,
        });
        break;
      }
    }
  }
}

/** Resolve a node to its static string value (handles template literals with no expressions). */
function resolveStaticString(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (
    node.type === 'TemplateLiteral' &&
    node.expressions.length === 0 &&
    node.quasis.length === 1
  ) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  return null;
}

/** Walk a CallExpression looking for `cn(...)`, `clsx(...)`, `cva(...)` arguments. */
function checkCallArguments(callNode, context) {
  for (const arg of callNode.arguments) {
    if (arg.type === 'SpreadElement') continue;

    const str = resolveStaticString(arg);
    if (str !== null) {
      checkClassString(str, arg, context);
      continue;
    }

    // `cn('foo', condition && 'bar', { 'baz': active })` — handle objects and arrays
    if (arg.type === 'ArrayExpression') {
      for (const el of arg.elements) {
        if (!el) continue;
        const s = resolveStaticString(el);
        if (s !== null) checkClassString(s, el, context);
      }
    } else if (arg.type === 'ObjectExpression') {
      for (const prop of arg.properties) {
        if (prop.type === 'Property' && prop.key.type === 'Literal') {
          checkClassString(String(prop.key.value), prop.key, context);
        }
      }
    } else if (arg.type === 'LogicalExpression') {
      const s = resolveStaticString(arg.right);
      if (s !== null) checkClassString(s, arg.right, context);
    } else if (arg.type === 'ConditionalExpression') {
      const sC = resolveStaticString(arg.consequent);
      const sA = resolveStaticString(arg.alternate);
      if (sC !== null) checkClassString(sC, arg.consequent, context);
      if (sA !== null) checkClassString(sA, arg.alternate, context);
    }
  }
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow hard-coded Tailwind color utilities; require design token classes from tailwind.config.ts.',
      category: 'Design System',
      recommended: true,
      url: 'https://github.com/ASTROIDX556/astroid-web/blob/main/eslint-rules/no-hardcoded-colors.js',
    },
    schema: [],
    messages: {
      forbidden:
        "Design token violation: '{{cls}}' is a hard-coded color. Use a semantic token class instead.",
    },
  },

  create(context) {
    return {
      // className="..." JSX attribute
      JSXAttribute(node) {
        const name = node.name.name;
        if (name !== 'className' && name !== 'class') return;
        if (!node.value) return;

        // className="literal string"
        if (node.value.type === 'Literal') {
          checkClassString(String(node.value.value), node.value, context);
          return;
        }

        // className={expression}
        if (node.value.type === 'JSXExpressionContainer') {
          const expr = node.value.expression;

          // className={`...`}
          const str = resolveStaticString(expr);
          if (str !== null) {
            checkClassString(str, expr, context);
            return;
          }

          // className={cn(...)} / clsx(...) / cva(...)
          if (expr.type === 'CallExpression') {
            const callee = expr.callee;
            const fnName =
              callee.type === 'Identifier'
                ? callee.name
                : callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
                ? callee.property.name
                : null;
            if (fnName && ['cn', 'clsx', 'cva', 'cx', 'classnames'].includes(fnName)) {
              checkCallArguments(expr, context);
            }
          }
        }
      },

      // const x = cva('...', { variants: { ... } })  — module-level cva calls
      CallExpression(node) {
        const callee = node.callee;
        const fnName =
          callee.type === 'Identifier'
            ? callee.name
            : callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
            ? callee.property.name
            : null;

        if (!fnName || !['cn', 'clsx', 'cva', 'cx', 'classnames'].includes(fnName)) return;
        checkCallArguments(node, context);
      },
    };
  },
};

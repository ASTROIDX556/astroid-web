/**
 * Local ESLint plugin: astroid/design-tokens
 *
 * Registers the custom rules that enforce design-token compliance across the
 * component layer. Import this file via the `plugins` key in .eslintrc.json.
 *
 * Usage in .eslintrc.json:
 *   {
 *     "plugins": ["./eslint-rules"],
 *     "rules": {
 *       "local-rules/no-hardcoded-colors": "warn"
 *     }
 *   }
 */
'use strict';

module.exports = {
  rules: {
    'no-hardcoded-colors': require('./no-hardcoded-colors'),
  },
};

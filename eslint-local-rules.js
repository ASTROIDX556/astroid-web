/**
 * Local ESLint rules registration for `eslint-plugin-local-rules`.
 *
 * This file is discovered automatically by the plugin (it looks for
 * `eslint-local-rules.js` in the project root). Rules are defined in
 * ./eslint-rules/ and enforced via the "local-rules/..." prefix in
 * .eslintrc.json.
 *
 * Adding a new rule:
 *   1. Create `eslint-rules/<rule-name>.js`.
 *   2. Export it here under its kebab-case name.
 *   3. Enable it in .eslintrc.json with "local-rules/<rule-name>": "warn"|"error".
 */
'use strict';

module.exports = {
  'no-hardcoded-colors': require('./eslint-rules/no-hardcoded-colors'),
};

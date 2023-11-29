/* eslint-disable no-restricted-globals */

const DOMGlobals = ['window', 'document']
const NodeGlobals = ['module', 'require']

const banConstEnum = {
  selector: 'TSEnumDeclaration[const=true]',
  message:
    'Please use non-const enums. This project automatically inlines enums.'
}

/**
 * @type {import('eslint-define-config').ESLintConfig}
 */
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module'
  },
  plugins: ['jest'],
  rules: {
    'no-debugger': 'error',
    // most of the codebase are expected to be env agnostic
    'no-restricted-globals': ['error', ...DOMGlobals, ...NodeGlobals],

    'no-restricted-syntax': [
      'error',
      banConstEnum,
      // since we target ES2015 for baseline support, we need to forbid object
      // rest spread usage in destructure as it compiles into a verbose helper.
      'ObjectPattern > RestElement',
      // tsc compiles assignment spread into Object.assign() calls, but esbuild
      // still generates verbose helpers, so spread assignment is also prohiboted
      'ObjectExpression > SpreadElement',
      'AwaitExpression'
    ]
  },
  overrides: [
    // tests, no restrictions (runs in Node / jest with jsdom)
    {
      files: ['**/__tests__/**', 'packages/dts-test/**'],
      rules: {
        'no-restricted-globals': 'off',
        'no-restricted-syntax': 'off',
        'jest/no-disabled-tests': 'error',
        'jest/no-focused-tests': 'error'
      }
    },
    // shared, may be used in any env
    {
      files: ['packages/shared/**'],
      rules: {
        'no-restricted-globals': 'off'
      }
    },
    // Packages targeting DOM
    {
      files: ['packages/{vue,vue-compat,runtime-dom}/**'],
      rules: {
        'no-restricted-globals': ['error', ...NodeGlobals]
      }
    },
    // Packages targeting Node
    {
      files: ['packages/{compiler-sfc,compiler-ssr,server-renderer}/**'],
      rules: {
        'no-restricted-globals': ['error', ...DOMGlobals],
        'no-restricted-syntax': ['error', banConstEnum]
      }
    },
    // Private package, browser only + no syntax restrictions
    {
      files: ['packages/template-explorer/**', 'packages/sfc-playground/**'],
      rules: {
        'no-restricted-globals': ['error', ...NodeGlobals],
        'no-restricted-syntax': ['error', banConstEnum]
      }
    },
    // JavaScript files
    {
      files: ['*.js', '*.cjs'],
      rules: {
        // We only do `no-unused-vars` checks for js files, TS files are checked by TypeScript itself.
        'no-unused-vars': ['error', { vars: 'all', args: 'none' }]
      }
    },
    // Node scripts
    {
      files: ['scripts/**', '*.{js,ts}', 'packages/**/index.js'],
      rules: {
        'no-restricted-globals': 'off',
        'no-restricted-syntax': ['error', banConstEnum]
      }
    }
  ]
}

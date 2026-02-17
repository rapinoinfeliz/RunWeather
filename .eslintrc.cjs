module.exports = {
    root: true,
    env: {
        browser: true,
        node: true,
        es2022: true
    },
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    extends: ['eslint:recommended'],
    ignorePatterns: [
        'node_modules/',
        'tests/e2e/**-snapshots/',
        'gel-calculator/**',
        'data/*.js'
    ],
    rules: {
        'no-undef': 'off',
        'no-unused-vars': 'off',
        'no-empty': ['error', { allowEmptyCatch: true }]
    }
};

module.exports = {
  'extends': 'airbnb',
  'installedESLint': true,
  'plugins': [
    'jsx-a11y',
  ],
  'rules': {
    'semi': ['error', 'never'],
    'no-multi-spaces': 0,
    'key-spacing': ['error', {'align': 'value'}],
    'new-cap': 0,
    'no-nested-ternary': 0,
    'no-console': 0,
    'no-plusplus': 0,
    'no-unused-vars': ['error', { argsIgnorePattern: 'next' }],
    'arrow-parens': ['error', 'as-needed'],
    'import/no-extraneous-dependencies': 0,
    'import/no-unresolved': 0,
  },
}

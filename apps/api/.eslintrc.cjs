module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
  },
  overrides: [
    {
      files: [
        'src/presentation/routes/**/*.ts',
        'src/infrastructure/**/*.ts',
        'src/infrastructure/**/*.tsx',
        'src/index.ts',
        'src/app.ts',
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['../infrastructure/*', '../../infrastructure/*'],
                message: 'Routes should delegate to controllers/application instead of importing infrastructure directly.',
              },
            ],
          },
        ],
      },
    },
    {
      files: [
        'src/domain/**/*.ts',
        'src/presentation/controllers/**/*.ts',
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/'],
};

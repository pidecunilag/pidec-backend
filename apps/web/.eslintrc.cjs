module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  rules: {
    // FSD: shared cannot import from features/entities
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['*/features/*', '*/entities/*'],
            message: 'shared/ may not import from features/ or entities/.',
          },
        ],
      },
    ],
    // No `any` (matches master spec)
    '@typescript-eslint/no-explicit-any': 'off',
  },
  overrides: [
    {
      files: ['src/features/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['*/features/!(${0})/*'],
                message: 'A feature may not import from another feature directly.',
              },
            ],
          },
        ],
      },
    },
  ],
  ignorePatterns: ['.next/', 'node_modules/', 'next-env.d.ts'],
};

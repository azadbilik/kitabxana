import { FlatCompat } from '@eslint/eslintrc';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'public/sw.js', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // next/core-web-vitals registers jsx-a11y and turns on six of its rules; this is the
      // plugin's whole recommended set (labels, roles, keyboard handlers, focus)
      ...jsxA11y.flatConfigs.recommended.rules,
      // Every autoFocus here is a field the reader has just asked for: the search page
      // opened without a query, a rename box, the admin login
      'jsx-a11y/no-autofocus': 'off',
    },
  },
];

export default config;

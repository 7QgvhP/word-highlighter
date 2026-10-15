// ESLint の設定（TypeScript のソースとテストを対象にする）
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-test/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['media/**/*.js'],
    languageOptions: {
      globals: {
        acquireVsCodeApi: 'readonly',
        document: 'readonly',
        window: 'readonly',
        console: 'readonly',
      },
    },
  },
);

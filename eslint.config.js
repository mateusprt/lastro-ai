import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/server/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // O frontend nunca importa o motor nem nada do servidor: o código da
      // simulação não pode ir parar no bundle entregue ao navegador.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/server/**', '**/engine/**', '**/engine'],
              message: 'O frontend não pode importar o motor nem o servidor. Use os tipos de src/shared e a API.',
            },
          ],
        },
      ],
    },
  },
  {
    // Testes não entram no bundle: podem usar o motor para gerar resultados reais.
    files: ['src/web/**/__tests__/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);

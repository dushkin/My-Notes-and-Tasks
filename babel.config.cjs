// babel.config.cjs
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  plugins: [
    // This plugin allows Babel to parse import.meta syntax
    '@babel/plugin-syntax-import-meta',
  ],
  env: {
    test: {
      plugins: [
        // This plugin will replace import.meta.env with a defined object
        [
          'transform-define',
          {
            // Replace the entire import.meta.env object in the test environment
            'import.meta.env': {
              VITE_API_BASE_URL: process.env.VITE_API_BASE_URL_FOR_JEST_TESTS || 'http://localhost:7777/api/from-babel-config',
              // Add any other VITE_ environment variables your components might use,
              // e.g., OTHER_VAR: '"some_test_value"'
            }
          }
        ]
      ]
    }
  }
};
// babel.config.cjs - Alternative approach
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  env: {
    test: {
      plugins: [
        [
          '@babel/plugin-syntax-import-meta',
          {
            'import.meta.env': {
              VITE_API_BASE_URL: process.env.VITE_API_BASE_URL_FOR_JEST_TESTS || 'http://localhost:5001/api'
            }
          }
        ]
      ]
    }
  }
};
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  env: {
    test: {
      plugins: [
        // This plugin ensures Babel can parse the import.meta syntax.
        '@babel/plugin-syntax-import-meta',
        [
          'transform-define',
          {
            // Replace the entire `import.meta.env` object.
            'import.meta.env': {
              VITE_API_BASE_URL:
                process.env.VITE_API_BASE_URL_FOR_JEST_TESTS ||
                'http://localhost:7777/api/defined-in-babel'
            }
          }
        ]
      ]
    }
  }
};

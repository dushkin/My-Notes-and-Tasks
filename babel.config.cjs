module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-react',
  ],
  env: {
    production: {
      plugins: [
        [
          'transform-define',
          {
            'process.env.VITE_API_BASE_URL': process.env.VITE_API_BASE_URL || 'http://localhost:5001/api',
          },
        ],
      ],
    },
    // In the test environment, no plugins are applied.
    test: {
      plugins: []
    }
  },
};

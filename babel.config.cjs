// babel.config.cjs
module.exports = {
    presets: [
      // compile modern JS to your current Node target (used by jest)
      ['@babel/preset-env', { targets: { node: 'current' } }],
      // compile JSX
      '@babel/preset-react'
    ]
  };
  
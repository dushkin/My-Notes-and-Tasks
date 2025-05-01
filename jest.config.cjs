// jest.config.cjs
module.exports = {
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/tests', '<rootDir>/src'],
    moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
    transform: {
      '^.+\\.[jt]sx?$': 'babel-jest'
    },
    setupFilesAfterEnv: [
      '<rootDir>/jest.setup.js'
    ],
    testMatch: [
      '**/tests/**/*.(test|spec).{js,jsx}'
    ]
  };
  
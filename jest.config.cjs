module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.[tj]sx?$': [
      'babel-jest',
      { configFile: './babel.config.cjs' }
    ]
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/tests/**/*.(test|spec).{js,jsx}'],
  moduleNameMapper: {
    'unicode-bidirectional': '<rootDir>/tests/__mocks__/unicodeBidirectionalMock.js'
  },
  moduleDirectories: ['node_modules', '<rootDir>']
};

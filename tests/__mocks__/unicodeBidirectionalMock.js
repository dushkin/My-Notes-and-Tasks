// tests/__mocks__/unicodeBidirectionalMock.js
module.exports = {
  embeddingLevels: jest.fn(() => []),
  reorder: jest.fn((txt) => txt),
};

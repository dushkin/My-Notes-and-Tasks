// tests/__mocks__/unicodeBidirectionalMock.js
module.exports = {
    getEmbeddingLevels: jest.fn(),
    getReorderedString: jest.fn((text) => text),
  };
// jest.setup.js
import '@testing-library/jest-dom';

// suppress React 18 deprecation warnings from react-dom/test-utils
const _consoleError = console.error;
console.error = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (
    msg.includes('ReactDOM.render is no longer supported in React 18') ||
    msg.includes('ReactDOMTestUtils.act') ||
    msg.includes('unmountComponentAtNode is deprecated')
  ) {
    return;
  }
  _consoleError(...args);
};

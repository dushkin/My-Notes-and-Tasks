import React from 'react';
import { render, screen } from '@testing-library/react';
import Tree from '../../src/components/Tree';

describe('Tree component', () => {
  const defaultProps = {
    items: [],
    selectedItemId: null,
    onSelect: jest.fn(),
    inlineRenameId: null,
    onInlineRename: jest.fn(),
    onRenameSubmit: jest.fn(),
    onRenameCancel: jest.fn(),
  };

  test('renders without crashing', () => {
    render(<Tree {...defaultProps} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  test('renders empty list when no items', () => {
    render(<Tree {...defaultProps} />);
    expect(screen.getByRole('navigation').querySelectorAll('li').length).toBe(0);
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react';
import FolderContents from '../../src/components/FolderContents';

describe('FolderContents component', () => {
  test('displays empty message when folder has no children', () => {
    const { getByText } = render(<FolderContents folder={{ children: [] }} onSelect={() => {}} />);
    expect(getByText('This folder is empty.')).toBeInTheDocument();
  });

  test('renders children items when folder has children', () => {
    const children = [
      { id: '1', label: 'Child One', type: 'note' },
      { id: '2', label: 'Child Two', type: 'task' },
    ];
    render(<FolderContents folder={{ children }} onSelect={() => {}} />);
    expect(screen.getByText('Child One')).toBeInTheDocument();
    expect(screen.getByText('(Note)')).toBeInTheDocument();
    expect(screen.getByText('Child Two')).toBeInTheDocument();
    expect(screen.getByText('(Task)')).toBeInTheDocument();
  });
});

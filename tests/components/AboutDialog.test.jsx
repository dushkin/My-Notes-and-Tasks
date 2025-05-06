// tests/components/AboutDialog.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AboutDialog from '../../src/components/AboutDialog';
import packageJson from '../../package.json'

describe('<AboutDialog />', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    // Mock current year for consistent testing
    jest.spyOn(global.Date.prototype, 'getFullYear').mockReturnValue(2025);
  });

  afterEach(() => {
    jest.restoreAllMocks(); // Restore original Date object
  });

  test('does not render when isOpen is false', () => {
    const { container } = render(<AboutDialog isOpen={false} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders correctly when isOpen is true', () => {
    render(<AboutDialog isOpen={true} onClose={mockOnClose} />);

    // Check title (adjust appName if changed in component)
    expect(screen.getByRole('heading', { name: /About Notes & Tasks App/i })).toBeInTheDocument();

    // Check app name and copyright (using text matching)
    expect(screen.getByText(/Notes & Tasks App © 2025/)).toBeInTheDocument();

    // Check version (use appVersion from component)
    expect(screen.getByText(new RegExp(`Version: ${packageJson.version}`))).toBeInTheDocument();

    // Check close button
    expect(screen.getByRole('button', { name: /Close/i })).toBeInTheDocument();
  });

  test('calls onClose when Close button is clicked', () => {
    render(<AboutDialog isOpen={true} onClose={mockOnClose} />);
    const closeButton = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

   test('modal overlay is present', () => {
    render(<AboutDialog isOpen={true} onClose={mockOnClose} />);
    // Check for the overlay div by its class structure (may need adjustment based on final styling)
    const overlay = screen.getByRole('button', { name: /Close/i }).closest('div.fixed.inset-0');
    expect(overlay).toHaveClass('bg-black', 'bg-opacity-50');
  });

   test('close button is focused on open', () => {
      render(<AboutDialog isOpen={true} onClose={mockOnClose} />);
      expect(screen.getByRole('button', { name: /Close/i })).toHaveFocus();
   });
});
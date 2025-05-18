// tests/components/AboutDialog.test.jsx
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import AboutDialog from "../../src/components/AboutDialog";
// Ensure package.json is correctly resolved relative to this test file, or mock it
// For simplicity, let's assume a mock or that the path is correct.
// If it causes issues, you might need to configure Jest's moduleNameMapper or mock package.json
let packageJson;
try {
  packageJson = require("../../package.json");
} catch (e) {
  // Mock if package.json is not found at that relative path during testing
  console.warn(
    "package.json not found for AboutDialog test, using mock version."
  );
  packageJson = { version: "1.0.0-test" };
}

describe("<AboutDialog />", () => {
  const mockOnClose = jest.fn();
  const originalGetFullYear = Date.prototype.getFullYear;

  beforeEach(() => {
    mockOnClose.mockClear();
    // Mock current year for consistent testing
    Date.prototype.getFullYear = jest.fn(() => 2025);
  });

  afterEach(() => {
    Date.prototype.getFullYear = originalGetFullYear; // Restore original Date object
  });

  test("does not render when isOpen is false", () => {
    const { container } = render(
      <AboutDialog isOpen={false} onClose={mockOnClose} />
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders correctly when isOpen is true", () => {
    render(<AboutDialog isOpen={true} onClose={mockOnClose} />);
    expect(
      screen.getByRole("heading", { name: /About Notes & Tasks App/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Notes & Tasks App © 2025/)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Version: ${packageJson.version}`))
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();
  });

  test("calls onClose when Close button is clicked", () => {
    render(<AboutDialog isOpen={true} onClose={mockOnClose} />);
    const closeButton = screen.getByRole("button", { name: /Close/i });
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("modal overlay is present", () => {
    render(<AboutDialog isOpen={true} onClose={mockOnClose} />);
    const overlay = screen
      .getByRole("button", { name: /Close/i })
      .closest("div.fixed.inset-0");
    expect(overlay).toHaveClass("bg-black", "bg-opacity-50");
  });

  test("close button is focused on open", () => {
    render(<AboutDialog isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByRole("button", { name: /Close/i })).toHaveFocus();
  });
});

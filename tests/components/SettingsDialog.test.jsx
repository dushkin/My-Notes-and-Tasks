// tests/components/SettingsDialog.test.jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import SettingsDialog from "../../src/components/SettingsDialog";
import { defaultSettings } from "../../src/contexts/SettingsContext";

const mockUpdateSetting = jest.fn();
const mockResetSettings = jest.fn();
const mockResetApplicationData = jest.fn();

jest.mock("../../src/contexts/SettingsContext", () => {
  const originalModule = jest.requireActual(
    "../../src/contexts/SettingsContext"
  );
  return {
    ...originalModule,
    useSettings: jest.fn(),
  };
});
const { useSettings } = require("../../src/contexts/SettingsContext");

describe("<SettingsDialog />", () => {
  const originalConfirm = window.confirm;

  beforeEach(() => {
    mockUpdateSetting.mockClear();
    mockResetSettings.mockClear();
    mockResetApplicationData.mockClear();
    useSettings.mockReturnValue({
      settings: { ...defaultSettings },
      updateSetting: mockUpdateSetting,
      resetSettings: mockResetSettings,
      resetApplicationData: mockResetApplicationData,
      defaultSettings: defaultSettings,
    });
    window.confirm = jest.fn(() => true);
  });

  afterEach(() => {
    window.confirm = originalConfirm;
  });

  test("does not render when isOpen is false", () => {
    const { container } = render(
      <SettingsDialog isOpen={false} onClose={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders correctly when isOpen is true", () => {
    render(<SettingsDialog isOpen={true} onClose={jest.fn()} />);
    expect(screen.getByTestId("settings-dialog-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("settings-dialog-content")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Settings/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("setting-row-theme")).toBeInTheDocument();
    expect(
      screen.getByTestId("setting-row-autoExpandNewFolders")
    ).toBeInTheDocument();
  });

  test("calls onClose when header Close button is clicked", async () => {
    const mockOnClose = jest.fn();
    render(<SettingsDialog isOpen={true} onClose={mockOnClose} />);
    await userEvent.click(screen.getByTestId("settings-close-button-header"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("calls onClose when footer Close button is clicked", async () => {
    const mockOnClose = jest.fn();
    render(<SettingsDialog isOpen={true} onClose={mockOnClose} />);
    await userEvent.click(screen.getByTestId("settings-close-button-footer"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("updates theme setting when selection changes", async () => {
    render(<SettingsDialog isOpen={true} onClose={jest.fn()} />);
    const themeSelect = screen.getByTestId("setting-theme-select");
    await userEvent.selectOptions(themeSelect, "dark");
    expect(mockUpdateSetting).toHaveBeenCalledWith("theme", "dark");
  });

  test("updates autoExpand setting when checkbox is clicked", async () => {
    useSettings.mockReturnValue({
      settings: { ...defaultSettings, autoExpandNewFolders: true },
      updateSetting: mockUpdateSetting,
      resetSettings: mockResetSettings,
      resetApplicationData: mockResetApplicationData,
      defaultSettings: defaultSettings,
    });

    render(<SettingsDialog isOpen={true} onClose={jest.fn()} />);
    const checkbox = screen.getByTestId("setting-autoexpand-checkbox");
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(mockUpdateSetting).toHaveBeenCalledWith(
      "autoExpandNewFolders",
      false
    );
  });

  test("filters settings based on search term in label", async () => {
    render(<SettingsDialog isOpen={true} onClose={jest.fn()} />);
    const searchInput = screen.getByTestId("settings-search-input");
    await userEvent.type(searchInput, "Theme");
    expect(screen.getByTestId("setting-row-theme")).toBeInTheDocument();
    expect(
      screen.queryByTestId("setting-row-autoExpandNewFolders")
    ).not.toBeInTheDocument();
  });

  test('displays "No settings found" message when search yields no results', async () => {
    render(<SettingsDialog isOpen={true} onClose={jest.fn()} />);
    const searchInput = screen.getByTestId("settings-search-input");
    await userEvent.type(searchInput, "xyznonexistentxyz");
    expect(screen.getByTestId("settings-no-results")).toBeInTheDocument();
  });

  test("calls resetSettings when Reset Settings button is clicked and confirmed", async () => {
    render(<SettingsDialog isOpen={true} onClose={jest.fn()} />);
    await userEvent.click(screen.getByTestId("setting-resetsettings-button"));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Reset all settings to default?")
    );
    expect(mockResetSettings).toHaveBeenCalledTimes(1);
  });

  test("calls resetApplicationData when Reset All Data button is clicked and confirmed", async () => {
    render(<SettingsDialog isOpen={true} onClose={jest.fn()} />);
    await userEvent.click(screen.getByTestId("setting-resetdata-button"));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining(
        "WARNING: This will permanently delete all application data"
      )
    );
    expect(mockResetApplicationData).toHaveBeenCalledTimes(1);
  });

  test("does NOT call resetSettings if confirm is cancelled", async () => {
    window.confirm.mockImplementationOnce(() => false);
    render(<SettingsDialog isOpen={true} onClose={jest.fn()} />);
    await userEvent.click(screen.getByTestId("setting-resetsettings-button"));
    expect(window.confirm).toHaveBeenCalled();
    expect(mockResetSettings).not.toHaveBeenCalled();
  });
});

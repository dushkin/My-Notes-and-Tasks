// tests/components/SettingsDialog.test.jsx
import React from "react";
import { render, screen } from "@testing-library/react"; // fireEvent removed if not directly used
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import SettingsDialog from "../../src/components/SettingsDialog";
import {
  SettingsContext,
  defaultSettings,
} from "../../src/contexts/SettingsContext";

const mockUpdateSetting = jest.fn();
const mockResetSettings = jest.fn();
const mockResetApplicationData = jest.fn();

const customRender = (ui, { providerProps, ...renderOptions }) => {
  return render(
    <SettingsContext.Provider value={providerProps}>
      {ui}
    </SettingsContext.Provider>,
    renderOptions
  );
};

describe("<SettingsDialog />", () => {
  let providerProps;
  const originalConfirm = window.confirm;

  beforeEach(() => {
    mockUpdateSetting.mockClear();
    mockResetSettings.mockClear();
    mockResetApplicationData.mockClear();
    providerProps = {
      settings: { ...defaultSettings },
      updateSetting: mockUpdateSetting,
      resetSettings: mockResetSettings,
      resetApplicationData: mockResetApplicationData,
    };
    window.confirm = jest.fn(() => true); // Mock window.confirm
  });

  afterEach(() => {
    window.confirm = originalConfirm; // Restore window.confirm
  });

  test("does not render when isOpen is false", () => {
    const { container } = customRender(
      <SettingsDialog isOpen={false} onClose={jest.fn()} />,
      { providerProps }
    );
    expect(container.firstChild).toBeNull();
  });

  test("renders correctly when isOpen is true", () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, {
      providerProps,
    });
    expect(screen.getByTestId("settings-dialog-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("settings-dialog-content")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Settings/i })
    ).toBeInTheDocument();
    // ... (other getByTestId checks for rows as in your original)
    expect(screen.getByTestId("setting-row-theme")).toBeInTheDocument();
    expect(
      screen.getByTestId("setting-row-autoExpandNewFolders")
    ).toBeInTheDocument();
  });

  test("calls onClose when header Close button is clicked", async () => {
    const mockOnClose = jest.fn();
    customRender(<SettingsDialog isOpen={true} onClose={mockOnClose} />, {
      providerProps,
    });
    await userEvent.click(screen.getByTestId("settings-close-button-header"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("calls onClose when footer Close button is clicked", async () => {
    const mockOnClose = jest.fn();
    customRender(<SettingsDialog isOpen={true} onClose={mockOnClose} />, {
      providerProps,
    });
    await userEvent.click(screen.getByTestId("settings-close-button-footer"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("updates theme setting when selection changes", async () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, {
      providerProps,
    });
    const themeSelect = screen.getByTestId("setting-theme-select");
    await userEvent.selectOptions(themeSelect, "dark");
    expect(mockUpdateSetting).toHaveBeenCalledWith("theme", "dark");
  });

  test("updates autoExpand setting when checkbox is clicked", async () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, {
      providerProps,
    });
    const checkbox = screen.getByTestId("setting-autoexpand-checkbox");
    expect(checkbox).toBeChecked(); // Default is true
    await userEvent.click(checkbox);
    expect(mockUpdateSetting).toHaveBeenCalledWith(
      "autoExpandNewFolders",
      false
    );
  });

  // ... (other specific setting change tests like fontFamily, fontSize, exportFormat as in your original)

  test("filters settings based on search term in label", async () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, {
      providerProps,
    });
    const searchInput = screen.getByTestId("settings-search-input");
    await userEvent.type(searchInput, "Theme");
    expect(screen.getByTestId("setting-row-theme")).toBeInTheDocument();
    expect(
      screen.queryByTestId("setting-row-autoExpandNewFolders")
    ).not.toBeInTheDocument();
  });

  test('displays "No settings found" message when search yields no results', async () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, {
      providerProps,
    });
    const searchInput = screen.getByTestId("settings-search-input");
    await userEvent.type(searchInput, "xyznonexistentxyz");
    expect(screen.getByTestId("settings-no-results")).toBeInTheDocument();
  });

  test("calls resetSettings when Reset Settings button is clicked and confirmed", async () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, {
      providerProps,
    });
    await userEvent.click(screen.getByTestId("setting-resetsettings-button"));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Reset all settings")
    );
    expect(mockResetSettings).toHaveBeenCalledTimes(1);
  });

  test("calls resetApplicationData when Reset All Data button is clicked and confirmed", async () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, {
      providerProps,
    });
    await userEvent.click(screen.getByTestId("setting-resetdata-button"));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("WARNING: This will permanently delete")
    );
    expect(mockResetApplicationData).toHaveBeenCalledTimes(1);
  });

  test("does NOT call resetSettings if confirm is cancelled", async () => {
    window.confirm.mockImplementationOnce(() => false); // Override for this test
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, {
      providerProps,
    });
    await userEvent.click(screen.getByTestId("setting-resetsettings-button"));
    expect(window.confirm).toHaveBeenCalled();
    expect(mockResetSettings).not.toHaveBeenCalled();
  });
});

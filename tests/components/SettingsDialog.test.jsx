// tests/components/SettingsDialog.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SettingsDialog from '../../src/components/SettingsDialog';
import { SettingsContext, defaultSettings } from '../../src/contexts/SettingsContext';

// Mock Context Provider
const mockUpdateSetting = jest.fn();
const mockResetSettings = jest.fn();
const mockResetApplicationData = jest.fn();

const customRender = (ui, { providerProps, ...renderOptions }) => {
  return render(
    <SettingsContext.Provider value={providerProps}>{ui}</SettingsContext.Provider>,
    renderOptions
  );
};

describe('<SettingsDialog />', () => {
  let providerProps;

  beforeEach(() => {
    // Reset mocks and provide default values for the context
    mockUpdateSetting.mockClear();
    mockResetSettings.mockClear();
    mockResetApplicationData.mockClear();
    providerProps = {
      settings: { ...defaultSettings }, // Start with defaults
      updateSetting: mockUpdateSetting,
      resetSettings: mockResetSettings,
      resetApplicationData: mockResetApplicationData,
    };
    // Mock window.confirm for reset tests
    jest.spyOn(window, 'confirm').mockImplementation(() => true);
  });

   afterEach(() => {
     jest.restoreAllMocks(); // Restore window.confirm
   });


  test('does not render when isOpen is false', () => {
    const { container } = customRender(
      <SettingsDialog isOpen={false} onClose={jest.fn()} />,
      { providerProps }
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders correctly when isOpen is true', () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });

    expect(screen.getByTestId('settings-dialog-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('settings-dialog-content')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Settings/i })).toBeInTheDocument();
    expect(screen.getByTestId('settings-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('setting-row-theme')).toBeInTheDocument();
    expect(screen.getByTestId('setting-row-autoExpandNewFolders')).toBeInTheDocument();
    expect(screen.getByTestId('setting-row-editorFontFamily')).toBeInTheDocument();
    expect(screen.getByTestId('setting-row-editorFontSize')).toBeInTheDocument();
    expect(screen.getByTestId('setting-row-defaultExportFormat')).toBeInTheDocument();
    expect(screen.getByTestId('setting-row-resetSettings')).toBeInTheDocument();
    expect(screen.getByTestId('setting-row-resetData')).toBeInTheDocument();
    expect(screen.getByTestId('settings-close-button-footer')).toBeInTheDocument();
    expect(screen.getByTestId('settings-close-button-header')).toBeInTheDocument();
  });

  test('calls onClose when header Close button is clicked', async () => {
    const mockOnClose = jest.fn();
    customRender(<SettingsDialog isOpen={true} onClose={mockOnClose} />, { providerProps });
    await userEvent.click(screen.getByTestId('settings-close-button-header'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('calls onClose when footer Close button is clicked', async () => {
      const mockOnClose = jest.fn();
      customRender(<SettingsDialog isOpen={true} onClose={mockOnClose} />, { providerProps });
      await userEvent.click(screen.getByTestId('settings-close-button-footer'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
   });


  test('updates theme setting when selection changes', async () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
    const themeSelect = screen.getByTestId('setting-theme-select');
    await userEvent.selectOptions(themeSelect, 'dark');
    expect(mockUpdateSetting).toHaveBeenCalledWith('theme', 'dark');
  });

  test('updates autoExpand setting when checkbox is clicked', async () => {
    // Start with default true
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
    const checkbox = screen.getByTestId('setting-autoexpand-checkbox');
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    // Should be called with the new state (false)
    expect(mockUpdateSetting).toHaveBeenCalledWith('autoExpandNewFolders', false);
  });

   test('updates fontFamily setting when selection changes', async () => {
      customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
      const fontSelect = screen.getByTestId('setting-fontfamily-select');
      await userEvent.selectOptions(fontSelect, 'Verdana');
      expect(mockUpdateSetting).toHaveBeenCalledWith('editorFontFamily', 'Verdana');
   });

   test('updates fontSize setting when selection changes', async () => {
      customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
      const sizeSelect = screen.getByTestId('setting-fontsize-select');
      await userEvent.selectOptions(sizeSelect, '5');
      expect(mockUpdateSetting).toHaveBeenCalledWith('editorFontSize', '5');
   });

    test('updates export format setting when radio button changes', async () => {
      // Default is json
      customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
      const pdfRadio = screen.getByTestId('setting-exportformat-pdf');
      await userEvent.click(pdfRadio);
      expect(mockUpdateSetting).toHaveBeenCalledWith('defaultExportFormat', 'pdf');
    });


  test('filters settings based on search term in label', async () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
    const searchInput = screen.getByTestId('settings-search-input');

    await userEvent.type(searchInput, 'Theme');
    expect(screen.getByTestId('setting-row-theme')).toBeInTheDocument();
    expect(screen.queryByTestId('setting-row-autoExpandNewFolders')).not.toBeInTheDocument(); // Should be filtered out
    expect(screen.queryByTestId('setting-row-resetSettings')).not.toBeInTheDocument();

    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'reset');
    expect(screen.queryByTestId('setting-row-theme')).not.toBeInTheDocument();
    expect(screen.getByTestId('setting-row-resetSettings')).toBeInTheDocument();
    expect(screen.getByTestId('setting-row-resetData')).toBeInTheDocument();
  });

   test('filters settings based on search term in description', async () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
    const searchInput = screen.getByTestId('settings-search-input');

    await userEvent.type(searchInput, 'color scheme'); // Part of theme description
    expect(screen.getByTestId('setting-row-theme')).toBeInTheDocument();
    expect(screen.queryByTestId('setting-row-resetData')).not.toBeInTheDocument();
  });

  test('filters settings based on search term in current value', async () => {
    // Override settings for this test to check value search
    providerProps.settings.theme = 'dark';
    providerProps.settings.defaultExportFormat = 'pdf';
    providerProps.settings.autoExpandNewFolders = false;

    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
    const searchInput = screen.getByTestId('settings-search-input');

    await userEvent.type(searchInput, 'Dark'); // Theme value label
    expect(screen.getByTestId('setting-row-theme')).toBeInTheDocument();
    expect(screen.queryByTestId('setting-row-defaultExportFormat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('setting-row-autoExpandNewFolders')).not.toBeInTheDocument();

     await userEvent.clear(searchInput);
     await userEvent.type(searchInput, 'PDF'); // Export value label
     expect(screen.queryByTestId('setting-row-theme')).not.toBeInTheDocument();
     expect(screen.getByTestId('setting-row-defaultExportFormat')).toBeInTheDocument();
     expect(screen.queryByTestId('setting-row-autoExpandNewFolders')).not.toBeInTheDocument();

     await userEvent.clear(searchInput);
     await userEvent.type(searchInput, 'Disabled'); // autoExpand value label
     expect(screen.queryByTestId('setting-row-theme')).not.toBeInTheDocument();
     expect(screen.queryByTestId('setting-row-defaultExportFormat')).not.toBeInTheDocument();
     expect(screen.getByTestId('setting-row-autoExpandNewFolders')).toBeInTheDocument();

  });

  test('displays "No settings found" message when search yields no results', async () => {
    customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
    const searchInput = screen.getByTestId('settings-search-input');
    await userEvent.type(searchInput, 'xyznonexistentxyz');
    expect(screen.getByTestId('settings-no-results')).toBeInTheDocument();
    expect(screen.queryByTestId('setting-row-theme')).not.toBeInTheDocument();
  });


   test('calls resetSettings when Reset Settings button is clicked', async () => {
      // Mock window.confirm to return true for this test
     // jest.spyOn(window, 'confirm').mockImplementationOnce(() => true);

      customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
      await userEvent.click(screen.getByTestId('setting-resetsettings-button'));

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('reset all settings'));
      expect(mockResetSettings).toHaveBeenCalledTimes(1);
   });

   test('calls resetApplicationData when Reset All Data button is clicked', async () => {
      // Mock window.confirm to return true for this test
      // jest.spyOn(window, 'confirm').mockImplementationOnce(() => true);

      customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
      await userEvent.click(screen.getByTestId('setting-resetdata-button'));

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('WARNING: This will permanently delete'));
      expect(mockResetApplicationData).toHaveBeenCalledTimes(1);
   });

    test('does NOT call resetSettings if confirm is cancelled', async () => {
      jest.spyOn(window, 'confirm').mockImplementationOnce(() => false);
      customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
      await userEvent.click(screen.getByTestId('setting-resetsettings-button'));
      expect(window.confirm).toHaveBeenCalled();
      expect(mockResetSettings).not.toHaveBeenCalled();
   });

   test('does NOT call resetApplicationData if confirm is cancelled', async () => {
     jest.spyOn(window, 'confirm').mockImplementationOnce(() => false);
     customRender(<SettingsDialog isOpen={true} onClose={jest.fn()} />, { providerProps });
     await userEvent.click(screen.getByTestId('setting-resetdata-button'));
     expect(window.confirm).toHaveBeenCalled();
     expect(mockResetApplicationData).not.toHaveBeenCalled();
  });

});
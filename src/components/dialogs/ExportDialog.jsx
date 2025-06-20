import React from 'react';
import Modal from '../Modal';
import { useSettings } from '../../../contexts/SettingsContext';

export default function ExportDialog({ isOpen, onClose, onExport }) {
  const { exportFormat } = useSettings();

  const handleExport = () => {
    onExport(exportFormat);
  };

  const actions = [
    { label: 'Cancel', onClick: onClose, variant: 'secondary' },
    { label: 'Export', onClick: handleExport, variant: 'primary' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Data" actions={actions}>
      <p>Choose your export format from Settings. Current: <strong>{exportFormat}</strong></p>
    </Modal>
  );
}

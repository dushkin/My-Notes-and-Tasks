import React, { useState } from 'react';
import Modal from '../Modal';

export default function ImportDialog({ isOpen, onClose, onImport }) {
  const [file, setFile] = useState(null);

  const handleImport = () => {
    if (file) onImport(file);
  };

  const actions = [
    { label: 'Cancel', onClick: onClose, variant: 'secondary' },
    { label: 'Import', onClick: handleImport, variant: 'primary' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Data" actions={actions}>
      <input
        type="file"
        accept=".json"
        onChange={(e) => setFile(e.target.files[0])}
        className="w-full"
      />
    </Modal>
  );
}

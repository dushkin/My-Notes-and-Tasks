import React from 'react';
import Modal from '../Modal';
import packageJson from '../../../package.json';
import logo from '../../assets/logo_dual_32x32.png';

export default function AboutDialog({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="About Notes & Tasks App"
      actions={[{ label: 'Close', onClick: onClose, variant: 'primary' }]}
    >
      <div className="flex items-center space-x-4">
        <img src={logo} alt="App Logo" className="w-8 h-8" />
        <div>
          <p><strong>Version:</strong> {packageJson.version}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            A simple, lightweight note-taking and task management application.
          </p>
        </div>
      </div>
    </Modal>
);
}

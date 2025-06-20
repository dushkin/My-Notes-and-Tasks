import React, { useState } from 'react';
import Modal from '../Modal';

export default function AddDialog({ isOpen, onClose, onAdd, selectedItem }) {
  const [name, setName] = useState('');

  const handleAdd = () => {
    onAdd(name);
    setName('');
  };

  const actions = [
    { label: 'Cancel', onClick: onClose, variant: 'secondary' },
    { label: 'Add', onClick: handleAdd, variant: 'primary' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Item" actions={actions}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={selectedItem ? 'New Sub-item Name' : 'New Item Name'}
        className="w-full px-3 py-2 border rounded"
      />
    </Modal>
  );
}

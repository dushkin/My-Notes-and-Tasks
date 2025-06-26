import { useState } from 'react';
import axios from '../lib/api';
import { Modal, Button } from '@/components/ui';

export default function CancelAccount() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const requestDeletion = async () => {
    setLoading(true);
    await axios.post('/api/account/delete-request');
    setStep(1);
    setLoading(false);
  };

  const confirmDeletion = async () => {
    setLoading(true);
    await axios.delete('/api/account');     // permanent delete
    window.location.href = '/goodbye';
  };

  return (
    <div>
      {step === 0 && (
        <Button onClick={() => setStep(‘confirm’)}>Delete Account</Button>
      )}
      {step === 'confirm' && (
        <Modal onClose={() => setStep(0)}>
          <h2>Export your data?</h2>
          <Button
            onClick={() => window.open('/api/account/export', '_blank')}
          >
            Export JSON
          </Button>
          <Button variant="destructive" onClick={requestDeletion} disabled={loading}>
            Send me confirmation email
          </Button>
        </Modal>
      )}
      {step === 1 && (
        <Modal onClose={() => setStep(0)}>
          <h2>Check your inbox</h2>
          <p>An email has been sent. Follow the link to finalize deletion.</p>
        </Modal>
      )}
    </div>
  );
}

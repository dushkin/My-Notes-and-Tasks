
import { useEffect, useState } from 'react';

export default function PushToggle({ currentUser }) {
  const [enabled, setEnabled] = useState(currentUser?.pushEnabled ?? true);

  useEffect(() => {
    if (currentUser?._id) {
      fetch('/api/users/update-push-enabled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser._id, enabled }),
      });
    }
  }, [enabled]);

  return (
    <div style={{ margin: '1rem 0' }}>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{' '}
        Enable push reminders
      </label>
    </div>
  );
}

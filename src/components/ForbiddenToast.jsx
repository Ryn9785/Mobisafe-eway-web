import { useEffect, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';

const AUTO_DISMISS_MS = 6000;



export default function ForbiddenToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    let nextId = 1;
    const handler = (event) => {
      const detail = event.detail || {};
      const id = nextId;
      nextId += 1;
      const message = detail.message || "You don't have permission to perform this action";
      setToasts((prev) => [...prev, { id, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, AUTO_DISMISS_MS);
    };
    window.addEventListener('auth:forbidden', handler);
    return () => window.removeEventListener('auth:forbidden', handler);
  }, []);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <>
      {toasts.map((t, idx) => (
        <Snackbar
          key={t.id}
          open
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ mt: `${idx * 64 + 8}px` }}
          onClose={() => dismiss(t.id)}
        >
          <Alert severity="error" variant="filled" onClose={() => dismiss(t.id)}>
            {t.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}

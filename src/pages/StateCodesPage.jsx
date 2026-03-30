import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import STATE_CODES from '../constants/stateCodes';
import {
  Box, Card, CardContent, Typography, Alert, Button, Checkbox,
  FormControlLabel, Grid, Chip, Divider, CircularProgress,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import MapIcon from '@mui/icons-material/Map';

export default function StateCodesPage() {
  const { user, isManager, refreshUser } = useAuth();
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.attributes?.ewayStateCodes) {
      const codes = String(user.attributes.ewayStateCodes)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);
      setSelected(new Set(codes));
    }
  }, [user]);

  if (!isManager) {
    return (
      <Alert severity="warning">
        Only admin users can configure state codes.
      </Alert>
    );
  }

  const toggle = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const codes = Array.from(selected).sort((a, b) => a - b);
      const updatedUser = {
        ...user,
        attributes: {
          ...user.attributes,
          ewayStateCodes: codes.join(','),
        },
      };
      const saved = await api.updateUser(updatedUser);
      await refreshUser(saved);
      setSuccess(`Saved ${codes.length} state code(s) successfully.`);
    } catch (err) {
      setError(err.message || 'Failed to save state codes');
    } finally {
      setLoading(false);
    }
  };

  const selectAll = () => setSelected(new Set(STATE_CODES.map((s) => s.code)));
  const clearAll = () => setSelected(new Set());

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 1 }}>
        State Codes Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select the Indian states whose eWay bills you want to fetch. Bills from these state
        codes will be queried when fetching transporter bills.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      {selected.size > 0 && (
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {Array.from(selected)
            .sort((a, b) => a - b)
            .map((code) => {
              const st = STATE_CODES.find((s) => s.code === code);
              return (
                <Chip
                  key={code}
                  label={`${code} - ${st?.name || 'Unknown'}`}
                  size="small"
                  color="primary"
                  onDelete={() => toggle(code)}
                />
              );
            })}
        </Box>
      )}

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <MapIcon color="primary" />
            <Typography variant="h6">Indian GST State Codes</Typography>
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button size="small" onClick={selectAll}>
                Select All
              </Button>
              <Button size="small" onClick={clearAll}>
                Clear All
              </Button>
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={0}>
            {STATE_CODES.map((st) => (
              <Grid item xs={12} sm={6} md={4} key={st.code}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selected.has(st.code)}
                      onChange={() => toggle(st.code)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      <strong>{String(st.code).padStart(2, '0')}</strong> - {st.name}
                    </Typography>
                  }
                  sx={{ width: '100%', m: 0, py: 0.25 }}
                />
              </Grid>
            ))}
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Button
            variant="contained"
            size="large"
            onClick={handleSave}
            disabled={loading || selected.size === 0}
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {loading ? 'Saving...' : `Save ${selected.size} State Code(s)`}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

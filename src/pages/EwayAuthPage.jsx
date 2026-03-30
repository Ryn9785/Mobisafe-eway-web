import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Chip, Divider,
  CircularProgress,
} from '@mui/material';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export default function EwayAuthPage() {
  const { user, isManager, refreshUser } = useAuth();
  const [gstin, setGstin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.attributes?.ewayGstin) {
      setGstin(user.attributes.ewayGstin);
    }
  }, [user]);

  if (!isManager) {
    return (
      <Alert severity="warning">
        Only admin users can configure eWay authentication.
      </Alert>
    );
  }

  const handleAuthenticate = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const trimmedGstin = gstin.trim().toUpperCase();
      const res = await api.ewayAuthenticate(trimmedGstin, username.trim(), password);

      if (res.Status === 1) {
        setResult(res);

        const cleanedAttrs = { ...user.attributes };
        delete cleanedAttrs.ewayUsername;
        delete cleanedAttrs.ewayPassword;
        cleanedAttrs.ewayGstin = trimmedGstin;

        const updatedUser = {
          ...user,
          attributes: cleanedAttrs,
        };
        const saved = await api.updateUser(updatedUser);
        await refreshUser(saved);
        setError('');
      } else {
        const errMsg =
          res.ErrorDetails && res.ErrorDetails.length > 0
            ? res.ErrorDetails.map((e) => e.ErrorMessage).join(', ')
            : 'Authentication failed';
        setError(errMsg);
      }
    } catch (err) {
      setError(err.message || 'Failed to authenticate with eWay API');
    } finally {
      setLoading(false);
    }
  };

  const savedGstin = user?.attributes?.ewayGstin;

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3 }}>
        eWay Authentication
      </Typography>

      {savedGstin && (
        <Card sx={{ mb: 3, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2, '&:last-child': { pb: 2 } }}>
            <CheckCircleIcon color="success" />
            <Box>
              <Typography variant="body2" color="text.secondary">
                Configured GSTIN
              </Typography>
              <Typography variant="subtitle1" fontWeight={600}>
                {savedGstin}
              </Typography>
            </Box>
            <Chip label="Active" color="success" size="small" sx={{ ml: 'auto' }} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <VpnKeyIcon color="primary" />
            <Typography variant="h6">
              {savedGstin ? 'Re-authenticate / Change GSTIN' : 'Authenticate eWay Credentials'}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter your eWay Bill API credentials. The authentication token will be
            stored securely and auto-renewed when it expires.
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {result && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Authentication successful! Token expires: {result.Data?.TokenExpiry}
            </Alert>
          )}

          <form onSubmit={handleAuthenticate}>
            <TextField
              fullWidth
              label="GSTIN"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              required
              placeholder="e.g., 24ABICS2160H1ZH"
              helperText="15-character GST Identification Number"
              inputProps={{ maxLength: 15, style: { textTransform: 'uppercase' } }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="eWay Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="eWay Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              sx={{ mb: 3 }}
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <VpnKeyIcon />}
            >
              {loading ? 'Authenticating...' : 'Authenticate'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}

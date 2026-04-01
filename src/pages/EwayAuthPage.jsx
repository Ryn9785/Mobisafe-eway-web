import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import STATE_CODES from '../constants/stateCodes';
import { getGstinList, buildGstinAttributes, isValidGstin } from '../utils/gstinHelpers';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Chip, Divider,
  CircularProgress, IconButton, Collapse, Dialog, DialogTitle, DialogContent,
  DialogActions, Grid, Checkbox, FormControlLabel, Tooltip, Paper,
} from '@mui/material';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MapIcon from '@mui/icons-material/Map';
import SaveIcon from '@mui/icons-material/Save';

export default function EwayAuthPage() {
  const { user, isManager, refreshUser } = useAuth();
  const [gstinList, setGstinList] = useState([]);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [expandedGstin, setExpandedGstin] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [savingCodes, setSavingCodes] = useState(null); // gstin being saved
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.attributes) {
      setGstinList(getGstinList(user.attributes));
    }
  }, [user]);

  if (!isManager) {
    return (
      <Alert severity="warning">
        Only admin users can configure eWay authentication.
      </Alert>
    );
  }

  const handleAuthSuccess = async (gstin) => {
    // Add new GSTIN to list if not already present
    const exists = gstinList.find((g) => g.gstin === gstin);
    const updatedList = exists
      ? gstinList
      : [...gstinList, { gstin, stateCodes: [] }];

    const updatedUser = {
      ...user,
      attributes: buildGstinAttributes(user.attributes, updatedList),
    };
    const saved = await api.updateUser(updatedUser);
    await refreshUser(saved);
    setGstinList(getGstinList(saved.attributes));
    setAuthDialogOpen(false);
    setSuccess(`GSTIN ${gstin} authenticated successfully.`);
  };

  const handleReAuth = async (gstin) => {
    setAuthDialogOpen(gstin); // pass existing gstin for re-auth
  };

  const handleDeleteGstin = async () => {
    if (!deleteConfirm) return;
    setError('');
    try {
      const updatedList = gstinList.filter((g) => g.gstin !== deleteConfirm);
      const updatedUser = {
        ...user,
        attributes: buildGstinAttributes(user.attributes, updatedList),
      };
      const saved = await api.updateUser(updatedUser);
      await refreshUser(saved);
      setGstinList(getGstinList(saved.attributes));
      setDeleteConfirm(null);
      setSuccess(`GSTIN ${deleteConfirm} removed.`);
    } catch (err) {
      setError(err.message || 'Failed to remove GSTIN');
      setDeleteConfirm(null);
    }
  };

  const handleSaveStateCodes = async (gstin, codes) => {
    setSavingCodes(gstin);
    setError('');
    try {
      const updatedList = gstinList.map((g) =>
        g.gstin === gstin ? { ...g, stateCodes: codes } : g,
      );
      const updatedUser = {
        ...user,
        attributes: buildGstinAttributes(user.attributes, updatedList),
      };
      const saved = await api.updateUser(updatedUser);
      await refreshUser(saved);
      setGstinList(getGstinList(saved.attributes));
      setSuccess(`State codes saved for ${gstin}.`);
    } catch (err) {
      setError(err.message || 'Failed to save state codes');
    } finally {
      setSavingCodes(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">GSTIN Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your GSTINs and configure state codes for each
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAuthDialogOpen(true)}
          sx={{ ml: 'auto' }}
        >
          Add GSTIN
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      {gstinList.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <VpnKeyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="h6" color="text.secondary">
              No GSTINs configured
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add a GSTIN and authenticate with eWay API to get started.
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAuthDialogOpen(true)}>
              Add First GSTIN
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {gstinList.map((entry) => (
            <GstinCard
              key={entry.gstin}
              entry={entry}
              expanded={expandedGstin === entry.gstin}
              onToggleExpand={() =>
                setExpandedGstin(expandedGstin === entry.gstin ? null : entry.gstin)
              }
              onReAuth={() => handleReAuth(entry.gstin)}
              onDelete={() => setDeleteConfirm(entry.gstin)}
              onSaveStateCodes={(codes) => handleSaveStateCodes(entry.gstin, codes)}
              savingCodes={savingCodes === entry.gstin}
            />
          ))}
        </Box>
      )}

      {/* Auth Dialog */}
      <AuthDialog
        open={Boolean(authDialogOpen)}
        onClose={() => setAuthDialogOpen(false)}
        onSuccess={handleAuthSuccess}
        prefillGstin={typeof authDialogOpen === 'string' ? authDialogOpen : ''}
      />

      {/* Delete Confirmation */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Remove GSTIN</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove GSTIN <strong>{deleteConfirm}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will also remove the associated state codes. Sub-users assigned this
            GSTIN will need to be updated.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteGstin}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ─── GSTIN Card with expandable State Codes ─── */

function GstinCard({ entry, expanded, onToggleExpand, onReAuth, onDelete, onSaveStateCodes, savingCodes }) {
  const [selectedCodes, setSelectedCodes] = useState(new Set(entry.stateCodes));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSelectedCodes(new Set(entry.stateCodes));
    setDirty(false);
  }, [entry.stateCodes]);

  const toggle = (code) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    setDirty(true);
  };

  const selectAll = () => {
    setSelectedCodes(new Set(STATE_CODES.map((s) => s.code)));
    setDirty(true);
  };

  const clearAll = () => {
    setSelectedCodes(new Set());
    setDirty(true);
  };

  const handleSave = () => {
    const codes = Array.from(selectedCodes).sort((a, b) => a - b);
    onSaveStateCodes(codes);
    setDirty(false);
  };

  return (
    <Card>
      <CardContent sx={{ pb: expanded ? 0 : undefined, '&:last-child': expanded ? {} : { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CheckCircleIcon color="success" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
              {entry.gstin}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {entry.stateCodes.length} state code(s) configured
            </Typography>
          </Box>
          <Chip label="Active" color="success" size="small" />
          <Tooltip title="Re-authenticate">
            <IconButton size="small" onClick={onReAuth}>
              <VpnKeyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remove GSTIN">
            <IconButton size="small" color="error" onClick={onDelete}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onToggleExpand}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        {/* State code chips preview (collapsed) */}
        {!expanded && entry.stateCodes.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {entry.stateCodes.slice(0, 8).map((sc) => {
              const st = STATE_CODES.find((s) => s.code === sc);
              return <Chip key={sc} label={`${String(sc).padStart(2, '0')} - ${st?.name || '?'}`} size="small" variant="outlined" />;
            })}
            {entry.stateCodes.length > 8 && (
              <Chip label={`+${entry.stateCodes.length - 8} more`} size="small" variant="outlined" />
            )}
          </Box>
        )}
      </CardContent>

      <Collapse in={expanded}>
        <Divider />
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <MapIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2">State Codes for {entry.gstin}</Typography>
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button size="small" onClick={selectAll}>Select All</Button>
              <Button size="small" onClick={clearAll}>Clear All</Button>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            Select the states whose eWay bills should be fetched for this GSTIN.
          </Typography>
          <Grid container spacing={0}>
            {STATE_CODES.map((st) => (
              <Grid item xs={12} sm={6} md={4} key={st.code}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedCodes.has(st.code)}
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
            onClick={handleSave}
            disabled={!dirty || savingCodes}
            startIcon={savingCodes ? <CircularProgress size={18} /> : <SaveIcon />}
          >
            {savingCodes ? 'Saving...' : `Save State Codes (${selectedCodes.size})`}
          </Button>
        </CardContent>
      </Collapse>
    </Card>
  );
}

/* ─── Authentication Dialog ─── */

function AuthDialog({ open, onClose, onSuccess, prefillGstin }) {
  const [gstin, setGstin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) {
      setGstin(prefillGstin || '');
      setUsername('');
      setPassword('');
      setError('');
      setResult(null);
    }
  }, [open, prefillGstin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedGstin = gstin.trim().toUpperCase();

    if (!isValidGstin(trimmedGstin)) {
      setError('Invalid GSTIN format. Expected 15-character GST number (e.g., 24ABICS2160H1ZH).');
      return;
    }

    setError('');
    setResult(null);
    setLoading(true);

    try {
      const res = await api.ewayAuthenticate(trimmedGstin, username.trim(), password);
      if (res.Status === 1) {
        setResult(res);
        await onSuccess(trimmedGstin);
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {prefillGstin ? `Re-authenticate ${prefillGstin}` : 'Add New GSTIN'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter eWay Bill API credentials. The authentication token will be
          stored securely and auto-renewed when it expires.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {result && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Authentication successful! Token expires: {result.Data?.TokenExpiry}
          </Alert>
        )}

        <form onSubmit={handleSubmit} id="auth-form">
          <TextField
            fullWidth
            label="GSTIN"
            value={gstin}
            onChange={(e) => setGstin(e.target.value)}
            required
            placeholder="e.g., 24ABICS2160H1ZH"
            helperText="15-character GST Identification Number"
            inputProps={{ maxLength: 15, style: { textTransform: 'uppercase' } }}
            disabled={Boolean(prefillGstin)}
            sx={{ mb: 2, mt: 1 }}
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
          />
        </form>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          form="auth-form"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} /> : <VpnKeyIcon />}
        >
          {loading ? 'Authenticating...' : 'Authenticate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

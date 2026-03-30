import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import STATE_CODES from '../constants/stateCodes';
import {
  Box, Card, CardContent, Typography, Alert, Button, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Checkbox, FormControlLabel, Grid,
  Divider, CircularProgress, Tooltip, Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CloseIcon from '@mui/icons-material/Close';

const EMPTY_FILTER = { fromGstin: '', fromPlace: '', fromTrdName: '' };

export default function UserManagementPage() {
  const { user, isManager } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const adminStateCodes = user?.attributes?.ewayStateCodes
    ? String(user.attributes.ewayStateCodes).split(',').map((s) => Number(s.trim())).filter((n) => n > 0)
    : [];

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getUsers(user.id);
      setUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isManager) fetchUsers();
  }, [isManager, fetchUsers]);

  if (!isManager) {
    return <Alert severity="warning">Only admin users can manage users.</Alert>;
  }

  const openCreate = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.deleteUser(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
      setDeleteConfirm(null);
    }
  };

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editingUser) {
        const updated = {
          ...editingUser,
          name: formData.name,
          attributes: {
            ...editingUser.attributes,
            ewayGstin: user.attributes?.ewayGstin || '',
            ewayStateCodes: formData.stateCodes.join(','),
            ewayFilters: formData.filters.filter(
              (f) => f.fromGstin || f.fromPlace || f.fromTrdName,
            ),
          },
        };
        await api.updateUser(updated);
      } else {
        const newUser = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          attributes: {
            ewayGstin: user.attributes?.ewayGstin || '',
            ewayStateCodes: formData.stateCodes.join(','),
            ewayFilters: formData.filters.filter(
              (f) => f.fromGstin || f.fromPlace || f.fromTrdName,
            ),
          },
        };
        await api.createUser(newUser);
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">User Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage sub-users with eWay bill filters
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={openCreate}
          sx={{ ml: 'auto' }}
        >
          Add User
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : users.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <PersonAddIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="h6" color="text.secondary">
              No users yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create sub-users to give them filtered access to eWay bill data.
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreate}>
              Add First User
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>State Codes</TableCell>
                <TableCell>Filters</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const uStateCodes = u.attributes?.ewayStateCodes
                  ? String(u.attributes.ewayStateCodes).split(',').filter(Boolean)
                  : [];
                const uFilters = u.attributes?.ewayFilters || [];

                return (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {u.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {uStateCodes.slice(0, 5).map((sc) => (
                          <Chip key={sc} label={sc} size="small" />
                        ))}
                        {uStateCodes.length > 5 && (
                          <Chip label={`+${uStateCodes.length - 5}`} size="small" variant="outlined" />
                        )}
                        {uStateCodes.length === 0 && (
                          <Typography variant="caption" color="text.secondary">
                            None
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {uFilters.length > 0 ? (
                        <Box>
                          {uFilters.slice(0, 2).map((f, i) => (
                            <Typography key={i} variant="caption" display="block" noWrap sx={{ maxWidth: 250 }}>
                              {f.fromGstin} | {f.fromPlace} | {f.fromTrdName}
                            </Typography>
                          ))}
                          {uFilters.length > 2 && (
                            <Typography variant="caption" color="text.secondary">
                              +{uFilters.length - 2} more
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No filters (sees all)
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => openEdit(u)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(u)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Dialog */}
      <UserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        editingUser={editingUser}
        adminStateCodes={adminStateCodes}
        saving={saving}
      />

      {/* Delete Confirmation */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteConfirm?.name}</strong> (
            {deleteConfirm?.email})?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function UserDialog({ open, onClose, onSave, editingUser, adminStateCodes, saving }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCodes, setSelectedCodes] = useState(new Set());
  const [filters, setFilters] = useState([{ ...EMPTY_FILTER }]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (editingUser) {
        setName(editingUser.name || '');
        setEmail(editingUser.email || '');
        setPassword('');
        const codes = editingUser.attributes?.ewayStateCodes
          ? String(editingUser.attributes.ewayStateCodes)
              .split(',')
              .map((s) => Number(s.trim()))
              .filter((n) => n > 0)
          : [];
        setSelectedCodes(new Set(codes));
        const existing = editingUser.attributes?.ewayFilters || [];
        setFilters(existing.length > 0 ? existing.map((f) => ({ ...f })) : [{ ...EMPTY_FILTER }]);
      } else {
        setName('');
        setEmail('');
        setPassword('');
        setSelectedCodes(new Set());
        setFilters([{ ...EMPTY_FILTER }]);
      }
      setError('');
    }
  }, [open, editingUser]);

  const toggleCode = (code) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const addFilter = () => setFilters((prev) => [...prev, { ...EMPTY_FILTER }]);

  const removeFilter = (idx) => setFilters((prev) => prev.filter((_, i) => i !== idx));

  const updateFilter = (idx, field, value) => {
    setFilters((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)),
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!editingUser && !email.trim()) {
      setError('Email is required');
      return;
    }
    if (!editingUser && !password) {
      setError('Password is required');
      return;
    }
    setError('');
    try {
      await onSave({
        name: name.trim(),
        email: email.trim(),
        password,
        stateCodes: Array.from(selectedCodes),
        filters,
      });
    } catch (err) {
      setError(err.message || 'Failed to save user');
    }
  };

  const availableStateCodes = adminStateCodes.length > 0
    ? STATE_CODES.filter((sc) => adminStateCodes.includes(sc.code))
    : STATE_CODES;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        {editingUser ? 'Edit User' : 'Add New User'}
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          User Details
        </Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={Boolean(editingUser)}
              size="small"
            />
          </Grid>
          {!editingUser && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                size="small"
              />
            </Grid>
          )}
        </Grid>

        <Divider sx={{ mb: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          State Codes
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Select which state codes this user can query. Only states configured in your admin
          account are available.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 3 }}>
          {availableStateCodes.map((sc) => (
            <Chip
              key={sc.code}
              label={`${String(sc.code).padStart(2, '0')} - ${sc.name}`}
              size="small"
              color={selectedCodes.has(sc.code) ? 'primary' : 'default'}
              onClick={() => toggleCode(sc.code)}
              variant={selectedCodes.has(sc.code) ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
          ))}
          {availableStateCodes.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No state codes configured in admin account. Please configure state codes first.
            </Typography>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">
            eWay Bill Filters
          </Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addFilter} sx={{ ml: 'auto' }}>
            Add Filter
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Bills are matched if ANY filter row matches. Leave a field blank to skip that criterion.
          If no filters are set, the user sees all bills.
        </Typography>

        {filters.map((f, idx) => (
          <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" fontWeight={600}>
                Filter {idx + 1}
              </Typography>
              {filters.length > 1 && (
                <IconButton size="small" onClick={() => removeFilter(idx)} sx={{ ml: 'auto' }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="From GSTIN"
                  value={f.fromGstin}
                  onChange={(e) => updateFilter(idx, 'fromGstin', e.target.value.toUpperCase())}
                  size="small"
                  placeholder="e.g., 24ABICS2160H1ZH"
                  inputProps={{ maxLength: 15 }}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Origin Place"
                  value={f.fromPlace}
                  onChange={(e) => updateFilter(idx, 'fromPlace', e.target.value.toUpperCase())}
                  size="small"
                  placeholder="e.g., ANKLESHWAR"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Consignor Trade Name"
                  value={f.fromTrdName}
                  onChange={(e) => updateFilter(idx, 'fromTrdName', e.target.value.toUpperCase())}
                  size="small"
                  placeholder="e.g., SIAM CEMENT..."
                />
              </Grid>
            </Grid>
          </Paper>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={18} /> : null}
        >
          {saving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

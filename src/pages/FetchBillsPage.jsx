import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import STATE_CODES, { getStateName } from '../constants/stateCodes';
import { formatEwayError } from '../constants/ewayErrors';
import { getGstinList } from '../utils/gstinHelpers';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Chip, Divider,
  CircularProgress, LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Collapse, Tooltip, TablePagination,
  TableSortLabel, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions,
  MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MoreTimeIcon from '@mui/icons-material/MoreTime';

const DETAILS_BATCH_SIZE = 150;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function formatCurrency(val) {
  if (val == null) return '-';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
}

function resolveEwayApiError(res) {
  if (!res) return 'Unknown error';
  const errObj = res.error || {};
  const info = res.info;
  const code = errObj.errorCodes || errObj.errorCode;
  const known = formatEwayError({ errorCodes: code, info });
  return known || info || 'Unknown error';
}

function parseValidUpto(validUpto) {
  if (!validUpto) return null;
  const m = validUpto.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
}

function canExtendBill(bill) {
  if (bill.status !== 'ACT') return false;
  const validDate = parseValidUpto(bill.validUpto);
  if (!validDate) return false;
  const now = Date.now();
  const eightHours = 8 * 60 * 60 * 1000;
  return now >= validDate.getTime() - eightHours && now <= validDate.getTime() + eightHours;
}

const COLUMNS = [
  { id: 'ewbNo', label: 'EWB No' },
  { id: 'ewayBillDate', label: 'Date' },
  { id: 'status', label: 'Status' },
  { id: 'fromGstin', label: 'From GSTIN' },
  { id: 'fromTrdName', label: 'Consignor' },
  { id: 'fromPlace', label: 'Origin' },
  { id: 'toTrdName', label: 'Consignee' },
  { id: 'toPlace', label: 'Destination' },
  { id: 'totInvValue', label: 'Invoice Value', align: 'right' },
  { id: 'validUpto', label: 'Valid Upto' },
];

export default function FetchBillsPage() {
  const { user } = useAuth();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ step: '', detail: '', pct: 0 });
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState(null);
  const [errors, setErrors] = useState([]);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [orderBy, setOrderBy] = useState('ewbNo');
  const [order, setOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [extendBill, setExtendBill] = useState(null);

  const gstinList = getGstinList(user?.attributes);
  const ewayFilters = user?.attributes?.ewayFilters || null;

  // Total number of GSTIN+state tasks for progress calculation
  const totalTasks = gstinList.reduce((sum, g) => sum + g.stateCodes.length, 0);
  const hasGstins = gstinList.length > 0;
  const hasStateCodes = gstinList.some((g) => g.stateCodes.length > 0);

  const handleFetch = async () => {
    if (!hasGstins) {
      setError('No GSTIN configured. Ask your admin to set up eWay authentication.');
      return;
    }
    if (!hasStateCodes) {
      setError('No state codes configured for any GSTIN. Ask your admin to configure state codes.');
      return;
    }

    setError('');
    setErrors([]);
    setBills([]);
    setStats(null);
    setLoading(true);
    setPage(0);

    const selectedDate = new Date(date + 'T00:00:00+05:30');
    const allEwbNos = new Set();
    const ewbNosByGstin = new Map(); // Track which eWay bills belong to which GSTIN
    const stateErrors = [];
    let tasksDone = 0;

    try {
      // Phase 1: Fetch transporter bills for each GSTIN + state code
      for (const gEntry of gstinList) {
        const { gstin, stateCodes } = gEntry;
        if (stateCodes.length === 0) continue;

        if (!ewbNosByGstin.has(gstin)) ewbNosByGstin.set(gstin, new Set());

        for (let i = 0; i < stateCodes.length; i++) {
          const sc = stateCodes[i];
          tasksDone++;
          setProgress({
            step: 'Fetching transporter bills',
            detail: `GSTIN ${gstin.slice(-4)} | State ${sc} - ${getStateName(sc)} (${tasksDone}/${totalTasks})`,
            pct: (tasksDone / totalTasks) * 40,
          });

          try {
            const res = await api.getTransporterBills(selectedDate, sc, gstin);
            if (Array.isArray(res)) {
              res.forEach((b) => {
                if (b.ewbNo) {
                  const ewbNo = Number(b.ewbNo);
                  allEwbNos.add(ewbNo);
                  ewbNosByGstin.get(gstin).add(ewbNo);
                }
              });
            } else if (res && res.status === '0') {
              stateErrors.push(`${gstin} | State ${sc} (${getStateName(sc)}): ${resolveEwayApiError(res)}`);
            }
          } catch (err) {
            stateErrors.push(`${gstin} | State ${sc} (${getStateName(sc)}): ${err.message}`);
          }
        }
      }

      if (allEwbNos.size === 0) {
        setErrors(stateErrors);
        setError(
          stateErrors.length > 0
            ? 'No bills found. Some queries returned errors (see below).'
            : 'No eWay bills found for the selected date across all configured GSTINs and states.',
        );
        setLoading(false);
        return;
      }

      // Phase 2: Fetch bill details per GSTIN using its own eWay bill numbers
      const allDetails = [];
      const detailErrors = [];
      let fetchedCount = 0;
      const totalBills = allEwbNos.size;
      let totalBatches = 0;
      let batchesDone = 0;

      // Calculate total batches for progress
      for (const [, ewbSet] of ewbNosByGstin) {
        if (ewbSet.size > 0) totalBatches += Math.ceil(ewbSet.size / DETAILS_BATCH_SIZE);
      }

      for (const [gstin, ewbSet] of ewbNosByGstin) {
        if (ewbSet.size === 0) continue;
        const ewbList = Array.from(ewbSet);
        const batches = chunk(ewbList, DETAILS_BATCH_SIZE);

        for (let i = 0; i < batches.length; i++) {
          batchesDone++;
          setProgress({
            step: 'Fetching bill details',
            detail: `GSTIN ${gstin.slice(-4)} — Batch ${batchesDone}/${totalBatches} (${fetchedCount}/${totalBills} bills)`,
            pct: 40 + (batchesDone / totalBatches) * 50,
          });

          try {
            const res = await api.getBillDetails(batches[i], gstin);
            if (res.bills) {
              allDetails.push(...res.bills);
              fetchedCount += res.bills.length;
            }
            if (res.errors) {
              detailErrors.push(
                ...res.errors.map((e) => `EWB ${e.ewbNo}: ${formatEwayError(e.error || e)}`),
              );
            }
          } catch (err) {
            detailErrors.push(`GSTIN ${gstin.slice(-4)} Batch ${i + 1}: ${err.message}`);
          }
        }
      }

      setProgress({ step: 'Processing results', detail: 'Applying filters...', pct: 95 });
      let filteredBills = allDetails;

      if (ewayFilters && Array.isArray(ewayFilters) && ewayFilters.length > 0) {
        filteredBills = allDetails.filter((bill) =>
          ewayFilters.some((f) => {
            const matchGstin = !f.fromGstin || (bill.fromGstin || '').toUpperCase() === f.fromGstin.toUpperCase();
            const matchPlace = !f.fromPlace || (bill.fromPlace || '').toUpperCase() === f.fromPlace.toUpperCase();
            const matchTrdName = !f.fromTrdName || (bill.fromTrdName || '').toUpperCase() === f.fromTrdName.toUpperCase();
            return matchGstin && matchPlace && matchTrdName;
          }),
        );
      }

      setBills(filteredBills);
      setStats({
        gstinsFetched: gstinList.filter((g) => g.stateCodes.length > 0).length,
        totalStateTasks: totalTasks,
        totalTransporterBills: allEwbNos.size,
        totalDetailsFetched: allDetails.length,
        totalAfterFilter: filteredBills.length,
      });
      setErrors([...stateErrors, ...detailErrors]);
      setProgress({ step: 'Done', detail: '', pct: 100 });
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    const ewayNos = filteredAndSorted.map((b) => b.ewbNo).filter(Boolean);
    if (ewayNos.length === 0) return;

    setExporting(true);
    try {
      const blob = await api.downloadShipmentExcel(
        ewayNos,
        `eway_bills_${date.replace(/-/g, '')}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eway_bills_${date.replace(/-/g, '')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Excel download failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleSort = (column) => {
    const isAsc = orderBy === column && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(column);
  };

  const handleExtendSuccess = (ewbNo, newValidUpto) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.ewbNo !== ewbNo) return b;
        const updated = { ...b };
        if (newValidUpto) updated.validUpto = newValidUpto;
        updated.extendedTimes = (b.extendedTimes || 0) + 1;
        return updated;
      }),
    );
  };

  const filtered = searchTerm
    ? bills.filter((b) => {
        const term = searchTerm.toLowerCase();
        return (
          String(b.ewbNo || '').includes(term) ||
          (b.fromTrdName || '').toLowerCase().includes(term) ||
          (b.fromGstin || '').toLowerCase().includes(term) ||
          (b.fromPlace || '').toLowerCase().includes(term) ||
          (b.toTrdName || '').toLowerCase().includes(term) ||
          (b.toPlace || '').toLowerCase().includes(term)
        );
      })
    : bills;

  const filteredAndSorted = [...filtered].sort((a, b) => {
    const aVal = a[orderBy] ?? '';
    const bVal = b[orderBy] ?? '';
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return order === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const paginatedBills = filteredAndSorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const getVehicle = (bill) => {
    if (bill.VehiclListDetails && bill.VehiclListDetails.length > 0) {
      return bill.VehiclListDetails[bill.VehiclListDetails.length - 1].vehicleNo || '-';
    }
    return '-';
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Fetch eWay Bills
      </Typography>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, color: 'text.secondary', fontSize: 14 }}>
        {hasGstins ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', width: '100%' }}>
            <span>GSTINs:</span>
            {gstinList.map((g) => (
              <Tooltip key={g.gstin} title={`States: ${g.stateCodes.length > 0 ? g.stateCodes.join(', ') : 'none'}`}>
                <Chip
                  label={g.gstin}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontFamily: 'monospace', fontSize: 11 }}
                />
              </Tooltip>
            ))}
          </Box>
        ) : (
          <Alert severity="info" sx={{ py: 0, width: '100%' }}>
            No GSTIN configured. Go to <strong>GSTIN Management</strong> to set it up.
          </Alert>
        )}
        {hasGstins && !hasStateCodes && (
          <Alert severity="info" sx={{ py: 0, width: '100%', mt: 0.5 }}>
            No state codes configured for any GSTIN. Go to <strong>GSTIN Management</strong> to set them up.
          </Alert>
        )}
        {ewayFilters && (
          <span>&middot; Filters: {ewayFilters.length} active</span>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
          <TextField
            type="date"
            label="Bill Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ width: 200 }}
          />
          <Tooltip
            title={
              !hasGstins
                ? 'Configure GSTINs in GSTIN Management first'
                : !hasStateCodes
                  ? 'Configure state codes for your GSTINs first'
                  : ''
            }
          >
            <span>
              <Button
                variant="contained"
                onClick={handleFetch}
                disabled={loading || !hasGstins || !hasStateCodes}
                startIcon={loading ? <CircularProgress size={18} /> : <SearchIcon />}
              >
                {loading ? 'Fetching...' : 'Fetch Bills'}
              </Button>
            </span>
          </Tooltip>
          {bills.length > 0 && (
            <Button
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={18} /> : <DownloadIcon />}
              onClick={handleExport}
              disabled={exporting}
              sx={{ ml: 'auto' }}
            >
              {exporting ? 'Downloading...' : `Download Excel (${filteredAndSorted.length})`}
            </Button>
          )}
        </CardContent>
        {loading && (
          <Box sx={{ px: 3, pb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">{progress.step}</Typography>
              <Typography variant="caption">{progress.detail}</Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress.pct} />
          </Box>
        )}
      </Card>

      {errors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" fontWeight={500}>
            Some queries returned warnings:
          </Typography>
          {errors.slice(0, 10).map((e, i) => (
            <Typography variant="caption" display="block" key={i}>
              {e}
            </Typography>
          ))}
          {errors.length > 10 && (
            <Typography variant="caption">...and {errors.length - 10} more</Typography>
          )}
        </Alert>
      )}

      {stats && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'GSTINs Queried', value: stats.gstinsFetched },
            { label: 'State Queries', value: stats.totalStateTasks },
            { label: 'Total Bills', value: stats.totalAfterFilter },
          ].map((s) => (
            <Card key={s.label} sx={{ flex: '1 1 140px' }}>
              <CardContent sx={{ textAlign: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {s.value}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {s.label}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {bills.length > 0 && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                size="small"
                placeholder="Search bills..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ width: 300 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                {filteredAndSorted.length} bills
              </Typography>
            </Box>
            <Divider />
            <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    {COLUMNS.map((col) => (
                      <TableCell key={col.id} align={col.align || 'left'}>
                        <TableSortLabel
                          active={orderBy === col.id}
                          direction={orderBy === col.id ? order : 'asc'}
                          onClick={() => handleSort(col.id)}
                        >
                          {col.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                    <TableCell>Vehicle</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedBills.map((bill) => (
                    <BillRow
                      key={bill.ewbNo}
                      bill={bill}
                      expanded={expandedRow === bill.ewbNo}
                      onToggle={() => setExpandedRow(expandedRow === bill.ewbNo ? null : bill.ewbNo)}
                      getVehicle={getVehicle}
                      onExtend={() => setExtendBill(bill)}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredAndSorted.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </CardContent>
        </Card>
      )}
      {extendBill && (
        <ExtendDialog
          key={extendBill.ewbNo}
          bill={extendBill}
          open
          onClose={() => setExtendBill(null)}
          onSuccess={handleExtendSuccess}
          gstin={gstinList[0]?.gstin || ''}
        />
      )}
    </Box>
  );
}

function BillRow({ bill, expanded, onToggle, getVehicle, onExtend }) {
  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: expanded ? 'none' : undefined } }}>
        <TableCell padding="checkbox">
          <IconButton size="small" onClick={onToggle}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
            {bill.ewbNo}
          </Typography>
        </TableCell>
        <TableCell>{bill.ewayBillDate || '-'}</TableCell>
        <TableCell>
          <Chip
            label={bill.status || '-'}
            size="small"
            color={bill.status === 'ACT' ? 'success' : bill.status === 'CNL' ? 'error' : 'default'}
            variant="outlined"
          />
        </TableCell>
        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{bill.fromGstin || '-'}</TableCell>
        <TableCell>
          <Tooltip title={bill.fromTrdName || ''}>
            <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
              {bill.fromTrdName || '-'}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>{bill.fromPlace || '-'}</TableCell>
        <TableCell>
          <Tooltip title={bill.toTrdName || ''}>
            <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
              {bill.toTrdName || '-'}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell>{bill.toPlace || '-'}</TableCell>
        <TableCell align="right">{formatCurrency(bill.totInvValue)}</TableCell>
        <TableCell>{bill.validUpto || '-'}</TableCell>
        <TableCell>{getVehicle(bill)}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={12} sx={{ py: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2">
                  Full Details
                </Typography>
                {canExtendBill(bill) && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<MoreTimeIcon />}
                    onClick={onExtend}
                  >
                    Extend Validity
                  </Button>
                )}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 1 }}>
                {[
                  ['EWB No', bill.ewbNo],
                  ['Gen Mode', bill.genMode],
                  ['User GSTIN', bill.userGstin],
                  ['From Address', [bill.fromAddr1, bill.fromAddr2].filter(Boolean).join(', ')],
                  ['From Pincode', bill.fromPincode],
                  ['From State', bill.fromStateCode],
                  ['To Address', [bill.toAddr1, bill.toAddr2].filter(Boolean).join(', ')],
                  ['To Pincode', bill.toPincode],
                  ['To State', bill.toStateCode],
                  ['Transporter', `${bill.transporterName || '-'} (${bill.transporterId || '-'})`],
                  ['Actual Distance', bill.actualDist ? `${bill.actualDist} km` : '-'],
                  ['Product', bill.productName],
                  ['HSN Code', bill.hsnCode],
                  ['Doc No', bill.docNo],
                  ['Doc Date', bill.docDate],
                  ['Extended Times', bill.extendedTimes],
                ].map(([label, value]) => (
                  <Box key={label}>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography variant="body2">{value || '-'}</Typography>
                  </Box>
                ))}
              </Box>
              {bill.VehiclListDetails && bill.VehiclListDetails.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Vehicle History ({bill.VehiclListDetails.length})
                  </Typography>
                  {bill.VehiclListDetails.map((v, i) => (
                    <Chip
                      key={i}
                      label={`${v.vehicleNo || '-'} | ${v.transDocNo || '-'} | ${v.transDocDate || '-'}`}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </Box>
              )}
              {bill.itemList && bill.itemList.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Items ({bill.itemList.length})
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>HSN</TableCell>
                        <TableCell>Product</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell align="right">Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bill.itemList.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>{item.hsnCode || item.hsn || '-'}</TableCell>
                          <TableCell>{item.productName || item.productDesc || '-'}</TableCell>
                          <TableCell align="right">{item.quantity ?? '-'}</TableCell>
                          <TableCell>{item.qtyUnit || '-'}</TableCell>
                          <TableCell align="right">{formatCurrency(item.taxableAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function ExtendDialog({ bill, open, onClose, onSuccess, gstin }) {
  const latestVehicle = bill.VehiclListDetails?.length > 0
    ? bill.VehiclListDetails[bill.VehiclListDetails.length - 1]
    : {};

  const [fromPlace, setFromPlace] = useState('');
  const [fromState, setFromState] = useState('');
  const [fromPincode, setFromPincode] = useState('');
  const [remainingDistance, setRemainingDistance] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    if (!fromPlace.trim()) { setError('From Place is required'); return; }
    if (!fromState) { setError('From State is required'); return; }
    if (!fromPincode || !/^\d{6}$/.test(fromPincode)) { setError('Pincode must be exactly 6 digits'); return; }
    const dist = parseFloat(remainingDistance);
    if (!dist || dist <= 0 || dist >= 10000) { setError('Distance must be between 0 and 10,000 km'); return; }

    setLoading(true);
    setError('');

    try {
      const body = {
        ewbNo: bill.ewbNo,
        vehicleNo: latestVehicle.vehicleNo || '',
        transDocNo: latestVehicle.transDocNo || '',
        transDocDate: latestVehicle.transDocDate || '',
        transMode: latestVehicle.transMode || '1',
        extnRsnCode: '99',
        extnRemarks: 'Delay',
        consignmentStatus: 'M',
        fromPlace: fromPlace.trim(),
        fromState: Number(fromState),
        fromPincode,
        remainingDistance: dist,
      };

      const res = await api.extendEwayBill(gstin, body);

      if (res && (res.status === '0' || res.status === 0)) {
        setError(resolveEwayApiError(res));
      } else {
        const newValidUpto = res?.validUpto || null;
        setSuccess(`eWay bill extended successfully.${newValidUpto ? ` New validity: ${newValidUpto}` : ''}`);
        onSuccess(bill.ewbNo, newValidUpto);
      }
    } catch (err) {
      setError(err.message || 'Failed to extend eWay bill');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Extend eWay Bill</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2, mt: 1 }}>{success}</Alert>}

        <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Auto-populated Details</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
          <TextField label="EWB No" value={bill.ewbNo || ''} size="small" disabled fullWidth />
          <TextField label="Vehicle No" value={latestVehicle.vehicleNo || '-'} size="small" disabled fullWidth />
          <TextField label="Trans Doc No" value={latestVehicle.transDocNo || '-'} size="small" disabled fullWidth />
          <TextField label="Trans Doc Date" value={latestVehicle.transDocDate || '-'} size="small" disabled fullWidth />
          <TextField label="Trans Mode" value={latestVehicle.transMode || '-'} size="small" disabled fullWidth />
          <TextField label="Consignment Status" value="M - In Movement" size="small" disabled fullWidth />
          <TextField label="Extension Reason" value="99 - Others" size="small" disabled fullWidth />
          <TextField label="Extension Remarks" value="Delay" size="small" disabled fullWidth />
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Enter Details</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <TextField
            label="From Place"
            value={fromPlace}
            onChange={(e) => setFromPlace(e.target.value)}
            size="small"
            required
            fullWidth
            disabled={!!success}
          />
          <TextField
            label="From State"
            value={fromState}
            onChange={(e) => setFromState(e.target.value)}
            size="small"
            required
            select
            fullWidth
            disabled={!!success}
          >
            {STATE_CODES.map((s) => (
              <MenuItem key={s.code} value={s.code}>{s.code} - {s.name}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="From Pincode"
            value={fromPincode}
            onChange={(e) => setFromPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            size="small"
            required
            fullWidth
            disabled={!!success}
            inputProps={{ maxLength: 6 }}
          />
          <TextField
            label="Remaining Distance (km)"
            value={remainingDistance}
            onChange={(e) => setRemainingDistance(e.target.value)}
            size="small"
            required
            fullWidth
            type="number"
            disabled={!!success}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{success ? 'Close' : 'Cancel'}</Button>
        {!success && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} /> : null}
          >
            {loading ? 'Extending...' : 'Extend'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

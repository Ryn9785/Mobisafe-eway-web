import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { getStateName } from '../constants/stateCodes';
import { formatEwayError } from '../constants/ewayErrors';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Chip, Divider,
  CircularProgress, LinearProgress, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Collapse, Tooltip, TablePagination,
  TableSortLabel, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

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

  const gstin = user?.attributes?.ewayGstin;
  const stateCodes = user?.attributes?.ewayStateCodes
    ? String(user.attributes.ewayStateCodes).split(',').map((s) => Number(s.trim())).filter((n) => n > 0)
    : [];
  const ewayFilters = user?.attributes?.ewayFilters || null;

  const handleFetch = async () => {
    if (!gstin) {
      setError('No GSTIN configured. Ask your admin to set up eWay authentication.');
      return;
    }
    if (stateCodes.length === 0) {
      setError('No state codes configured. Ask your admin to configure state codes.');
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
    const stateErrors = [];

    try {
      for (let i = 0; i < stateCodes.length; i++) {
        const sc = stateCodes[i];
        setProgress({
          step: 'Fetching transporter bills',
          detail: `State ${sc} - ${getStateName(sc)} (${i + 1}/${stateCodes.length})`,
          pct: ((i + 1) / stateCodes.length) * 40,
        });

        try {
          const res = await api.getTransporterBills(selectedDate, sc, gstin);
          if (Array.isArray(res)) {
            res.forEach((b) => {
              if (b.ewbNo) allEwbNos.add(Number(b.ewbNo));
            });
          } else if (res && res.status === '0') {
            stateErrors.push(`State ${sc} (${getStateName(sc)}): ${resolveEwayApiError(res)}`);
          }
        } catch (err) {
          stateErrors.push(`State ${sc} (${getStateName(sc)}): ${err.message}`);
        }
      }

      if (allEwbNos.size === 0) {
        setErrors(stateErrors);
        setError(
          stateErrors.length > 0
            ? 'No bills found. Some state queries returned errors (see below).'
            : 'No eWay bills found for the selected date across all configured states.',
        );
        setLoading(false);
        return;
      }

      const ewbList = Array.from(allEwbNos);
      const batches = chunk(ewbList, DETAILS_BATCH_SIZE);
      const allDetails = [];
      const detailErrors = [];
      let fetchedCount = 0;

      for (let i = 0; i < batches.length; i++) {
        setProgress({
          step: 'Fetching bill details',
          detail: `Batch ${i + 1}/${batches.length} (${fetchedCount}/${ewbList.length} bills)`,
          pct: 40 + ((i + 1) / batches.length) * 50,
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
          detailErrors.push(`Batch ${i + 1}: ${err.message}`);
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
        totalTransporterBills: allEwbNos.size,
        totalDetailsFetched: allDetails.length,
        totalAfterFilter: filteredBills.length,
        stateCodesFetched: stateCodes.length,
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
        {gstin ? (
          <span>GSTIN: <strong>{gstin}</strong></span>
        ) : (
          <Alert severity="info" sx={{ py: 0, width: '100%' }}>
            No GSTIN configured. Go to <strong>eWay Authentication</strong> to set it up.
          </Alert>
        )}
        {gstin && stateCodes.length > 0 && (
          <>
            <span>&middot; States:</span>
            {stateCodes.map((sc) => (
              <Chip key={sc} label={`${sc}`} size="small" />
            ))}
          </>
        )}
        {gstin && stateCodes.length === 0 && (
          <Alert severity="info" sx={{ py: 0, width: '100%', mt: 0.5 }}>
            No state codes configured. Go to <strong>State Codes</strong> to set them up.
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
              !gstin
                ? 'Configure GSTIN in eWay Authentication first'
                : stateCodes.length === 0
                  ? 'Configure State Codes first'
                  : ''
            }
          >
            <span>
              <Button
                variant="contained"
                onClick={handleFetch}
                disabled={loading || !gstin || stateCodes.length === 0}
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
            { label: 'States Queried', value: stats.stateCodesFetched },
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
    </Box>
  );
}

function BillRow({ bill, expanded, onToggle, getVehicle }) {
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
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Full Details
              </Typography>
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

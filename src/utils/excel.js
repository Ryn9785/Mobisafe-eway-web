import * as XLSX from 'xlsx';

export function exportBillsToExcel(bills, filename = 'eway_bills.xlsx') {
  if (!bills || bills.length === 0) return;

  const rows = bills.map((b) => {
    const vehicle =
      b.VehiclListDetails && b.VehiclListDetails.length > 0
        ? b.VehiclListDetails[b.VehiclListDetails.length - 1]
        : {};
    return {
      'EWB No': b.ewbNo,
      'EWB Date': b.ewayBillDate || '',
      Status: b.status || '',
      'Gen Mode': b.genMode || '',
      'User GSTIN': b.userGstin || '',
      'From GSTIN': b.fromGstin || '',
      'From Trade Name': b.fromTrdName || '',
      'From Place': b.fromPlace || '',
      'From State': b.fromStateCode || '',
      'From Pincode': b.fromPincode || '',
      'To GSTIN': b.toGstin || '',
      'To Trade Name': b.toTrdName || '',
      'To Place': b.toPlace || '',
      'To State': b.toStateCode || '',
      'To Pincode': b.toPincode || '',
      'Total Invoice Value': b.totInvValue || '',
      'CGST Value': b.cgstValue || '',
      'SGST Value': b.sgstValue || '',
      'IGST Value': b.igstValue || '',
      'CESS Value': b.cessValue || '',
      'Total CESS Nonadvol': b.totalCessNonAdvolVal || '',
      'Other Value': b.otherValue || '',
      'Product Name': b.productName || '',
      'Product Description': b.productDesc || '',
      'HSN Code': b.hsnCode || '',
      Quantity: b.totalQty || '',
      'Quantity Unit': b.qtyUnit || '',
      'Transporter ID': b.transporterId || '',
      'Transporter Name': b.transporterName || '',
      'Vehicle No': vehicle.vehicleNo || '',
      'Transport Doc No': vehicle.transDocNo || '',
      'Transport Doc Date': vehicle.transDocDate || '',
      'Trans Mode': vehicle.transMode || '',
      'Actual Distance': b.actualDist || '',
      'Valid Upto': b.validUpto || '',
      'Extended Times': b.extendedTimes || '',
      'Reject Status': b.rejectStatus || '',
      'Doc No': b.docNo || '',
      'Doc Date': b.docDate || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = Object.keys(rows[0]).map((key) => {
    const maxLen = Math.max(
      key.length,
      ...rows.map((r) => String(r[key] || '').length),
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'eWay Bills');
  XLSX.writeFile(wb, filename);
}

export function exportTransporterBillsToExcel(bills, filename = 'transporter_bills.xlsx') {
  if (!bills || bills.length === 0) return;

  const rows = bills.map((b) => ({
    'EWB No': b.ewbNo,
    'EWB Date': b.ewbDate || '',
    Status: b.status || '',
    'Generator GSTIN': b.genGstin || '',
    'Doc No': b.docNo || '',
    'Doc Date': b.docDate || '',
    'Delivery Pincode': b.delPinCode || '',
    'Delivery State Code': b.delStateCode || '',
    'Delivery Place': b.delPlace || '',
    'Valid Upto': b.validUpto || '',
    'Extended Times': b.extendedTimes || '',
    'Reject Status': b.rejectStatus || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transporter Bills');
  XLSX.writeFile(wb, filename);
}

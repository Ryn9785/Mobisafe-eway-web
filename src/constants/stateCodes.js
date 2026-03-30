const STATE_CODES = [
  { code: 1, name: 'Jammu & Kashmir' },
  { code: 2, name: 'Himachal Pradesh' },
  { code: 3, name: 'Punjab' },
  { code: 4, name: 'Chandigarh' },
  { code: 5, name: 'Uttarakhand' },
  { code: 6, name: 'Haryana' },
  { code: 7, name: 'Delhi' },
  { code: 8, name: 'Rajasthan' },
  { code: 9, name: 'Uttar Pradesh' },
  { code: 10, name: 'Bihar' },
  { code: 11, name: 'Sikkim' },
  { code: 12, name: 'Arunachal Pradesh' },
  { code: 13, name: 'Nagaland' },
  { code: 14, name: 'Manipur' },
  { code: 15, name: 'Mizoram' },
  { code: 16, name: 'Tripura' },
  { code: 17, name: 'Meghalaya' },
  { code: 18, name: 'Assam' },
  { code: 19, name: 'West Bengal' },
  { code: 20, name: 'Jharkhand' },
  { code: 21, name: 'Odisha' },
  { code: 22, name: 'Chhattisgarh' },
  { code: 23, name: 'Madhya Pradesh' },
  { code: 24, name: 'Gujarat' },
  { code: 25, name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: 26, name: 'Dadra & Nagar Haveli (Old)' },
  { code: 27, name: 'Maharashtra' },
  { code: 28, name: 'Andhra Pradesh (Old)' },
  { code: 29, name: 'Karnataka' },
  { code: 30, name: 'Goa' },
  { code: 31, name: 'Lakshadweep' },
  { code: 32, name: 'Kerala' },
  { code: 33, name: 'Tamil Nadu' },
  { code: 34, name: 'Puducherry' },
  { code: 35, name: 'Andaman & Nicobar Islands' },
  { code: 36, name: 'Telangana' },
  { code: 37, name: 'Andhra Pradesh' },
  { code: 38, name: 'Ladakh' },
  { code: 97, name: 'Other Territory' },
];

export default STATE_CODES;

export function getStateName(code) {
  const s = STATE_CODES.find((sc) => sc.code === Number(code));
  return s ? s.name : `State ${code}`;
}

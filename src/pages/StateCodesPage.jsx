import { Navigate } from 'react-router-dom';

/**
 * State codes are now configured per-GSTIN on the GSTIN Management page.
 * Redirect any bookmarks / old links to the new location.
 */
export default function StateCodesPage() {
  return <Navigate to="/eway-auth" replace />;
}

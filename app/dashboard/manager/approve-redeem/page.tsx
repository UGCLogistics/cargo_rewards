"use client";

import AdminApproveRedeemPage from '../../admin/approve-redeem/page';

/**
 * ManagerApproveRedeemPage reuses the admin component for approving
 * redemption requests. If you need manager-specific restrictions or
 * views, create a separate implementation here. For now this page
 * simply renders the admin version.
 */
export default function ManagerApproveRedeemPage() {
  return <AdminApproveRedeemPage />;
}
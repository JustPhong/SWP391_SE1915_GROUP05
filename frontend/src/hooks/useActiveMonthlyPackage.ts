import { useAuth } from '../context/AuthContext';

/**
 * Shared hook — determines whether the logged-in driver has at least one
 * ACTIVE, non-expired monthly package.
 *
 * It bridges directly to the single authoritative AuthContext store.
 */
export function useActiveMonthlyPackage() {
  const { hasActiveMonthlyPackage, isPackageLoading, activePackages, refreshPackageStatus } = useAuth();

  return {
    isPackageLoading,
    hasActiveMonthlyPackage,
    activePackages,
    refetch: refreshPackageStatus,
  };
}

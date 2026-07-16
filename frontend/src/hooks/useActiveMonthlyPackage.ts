import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import type { MonthlyPackage } from '../types';

/**
 * Shared hook — determines whether the logged-in driver has at least one
 * ACTIVE, non-expired monthly package.
 *
 * Active-package condition (identical everywhere: navbar, route guards):
 *   1. pkg.status === 'ACTIVE'
 *   2. pkg.expiryDate parses to a finite timestamp
 *   3. that timestamp is strictly greater than Date.now()
 *   4. ownership is guaranteed by /monthly-packages/mine (user-scoped endpoint)
 *
 * Deliberately NOT true when:
 *   - no packages exist (empty array)
 *   - status is EXPIRED, CANCELLED, INACTIVE, PENDING, REJECTED, or anything else
 *   - expiryDate is missing, null, or unparseable
 *   - expiryDate <= now (package has just expired)
 */
export function useActiveMonthlyPackage() {
  const { user, isLoading: authLoading } = useAuth();

  const [packages, setPackages] = useState<MonthlyPackage[]>([]);
  const [isPackageLoading, setIsPackageLoading] = useState(true);

  const fetchPackages = useCallback(async () => {
    setIsPackageLoading(true);
    try {
      const data = await monthlyPackageService.getMyPackages();
      setPackages(Array.isArray(data) ? data : []);
    } catch {
      setPackages([]);
    } finally {
      setIsPackageLoading(false);
    }
  }, []);

  useEffect(() => {
    // Do not call the API until auth has fully resolved
    if (authLoading) return;

    if (!user) {
      // Not logged in: no packages, stop loading immediately
      setPackages([]);
      setIsPackageLoading(false);
      return;
    }

    fetchPackages();
  }, [authLoading, user, fetchPackages]);

  /**
   * Safe active-package check.
   * An empty array is truthy in JS, so we use .some() — never Boolean([]).
   */
  const hasActiveMonthlyPackage = packages.some((pkg) => {
    if (pkg.status !== 'ACTIVE') return false;

    const expiryTime = new Date(pkg.expiryDate).getTime();

    // Reject missing, null, or unparseable expiry dates
    if (!Number.isFinite(expiryTime)) return false;

    // Package must not have expired yet
    return expiryTime > Date.now();
  });

  const activePackages = packages.filter((pkg) => {
    if (pkg.status !== 'ACTIVE') return false;
    const expiryTime = new Date(pkg.expiryDate).getTime();
    return Number.isFinite(expiryTime) && expiryTime > Date.now();
  });

  const isLoading = authLoading || isPackageLoading;

  return {
    /** True while auth or the package API call is still in flight */
    isPackageLoading: isLoading,
    /** True only after loading finishes AND at least 1 valid active package exists */
    hasActiveMonthlyPackage: !isLoading && hasActiveMonthlyPackage,
    activePackages,
    refetch: fetchPackages,
  };
}

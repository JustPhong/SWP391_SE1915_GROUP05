import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { monthlyPackageService } from '../services/monthlyPackage.service';
import type { MonthlyPackage } from '../types/index';

export type PaymentReturnState = 'IDLE' | 'VERIFYING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export function useMonthlyPaymentReturn(onSuccessCallback?: (pkgs: MonthlyPackage[]) => void) {
  const { user, refreshPackageStatus } = useAuth();
  const [paymentReturnState, setPaymentReturnState] = useState<PaymentReturnState>('IDLE');
  const [successDetails, setSuccessDetails] = useState<{ planId?: string; plateNumber?: string } | null>(null);
  const [packageActionError, setPackageActionError] = useState('');
  const [packageActionSuccess, setPackageActionSuccess] = useState('');

  // Single-flight guard: holds the sessionId currently being processed
  const processingSessionId = useRef<string | null>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startVerification = useCallback(async (sessionId: string) => {
    // Single-flight: prevent duplicate processing of the same session
    if (processingSessionId.current === sessionId) {
      console.log('[PaymentReturn] Already processing session:', sessionId);
      return;
    }
    processingSessionId.current = sessionId;

    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }

    setPaymentReturnState('VERIFYING');
    console.log('[PaymentReturn] Starting verification for session:', sessionId);

    const startTime = performance.now();
    const maxDuration = 25000; // 25 seconds

    const runReconciliation = async (retryCount: number) => {
      try {
        console.log(`[PaymentReturn] Calling reconcileSession (attempt ${retryCount + 1})`);
        const result = await monthlyPackageService.reconcileSession(sessionId);
        console.log('[PaymentReturn] reconcileSession result:', result);

        if (result.type === 'SUCCESS' || result.type === 'ALREADY_PROCESSED') {
          // Load latest package list
          const pkgs = await monthlyPackageService.getMyPackages();
          if (onSuccessCallback) {
            onSuccessCallback(pkgs ?? []);
          }

          // Update global resident status
          await refreshPackageStatus();

          // Build success display details from the authoritative response
          const planId = result.planId ?? undefined;
          const plateNumber = result.plateNumber ?? undefined;
          setSuccessDetails({ planId, plateNumber });

          setPaymentReturnState('SUCCESS');
          setPackageActionSuccess('Thanh toán và kích hoạt gói tháng thành công!');
          setPackageActionError('');

          // Clear sessionStorage payment context after terminal success
          sessionStorage.removeItem('pending_monthly_package_id');
          sessionStorage.removeItem('pending_monthly_payment_id');
          sessionStorage.removeItem('pending_monthly_session_id');
          sessionStorage.removeItem('pending_monthly_plan_id');
          sessionStorage.removeItem('pending_monthly_vehicle_id');
          sessionStorage.removeItem('pending_monthly_checkout_type');

          // Clean URL only after verified terminal success — preserves params for retry on error
          window.history.replaceState({}, document.title, window.location.pathname);

          console.log('[PaymentReturn] Terminal: SUCCESS');
          return;
        }

        // result.type === 'PENDING' — Stripe hasn't confirmed yet, retry
        const elapsed = performance.now() - startTime;
        if (elapsed >= maxDuration) {
          console.log('[PaymentReturn] Terminal: TIMEOUT after', elapsed, 'ms');
          setPaymentReturnState('TIMEOUT');
          setPackageActionError('Hết thời gian xác nhận thanh toán. Vui lòng thử lại sau.');
          return;
        }

        const delay = retryCount === 0 ? 850 : 1500;
        pollingTimeoutRef.current = setTimeout(() => {
          runReconciliation(retryCount + 1);
        }, delay);

      } catch (err: unknown) {
        const errObj = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
        console.error('[PaymentReturn] reconcileSession error:', errObj);

        const status = errObj?.response?.status;
        const message = errObj?.response?.data?.message || errObj?.message || 'Xác nhận thanh toán thất bại.';

        // 400/403/404 are definitive failures — stop immediately
        const isDefinitiveFailure = status !== undefined && status !== 409 && status !== 503 && status !== 504;

        if (isDefinitiveFailure) {
          console.log('[PaymentReturn] Terminal: FAILED with status', status);
          setPaymentReturnState('FAILED');
          setPackageActionError(message);
          return;
        }

        // 409/503/504 or network errors — retry within timeout window
        const elapsed = performance.now() - startTime;
        if (elapsed >= maxDuration) {
          console.log('[PaymentReturn] Terminal: TIMEOUT after error at', elapsed, 'ms');
          setPaymentReturnState('TIMEOUT');
          setPackageActionError('Hết thời gian xác nhận thanh toán. Vui lòng thử lại sau.');
          return;
        }

        const delay = retryCount === 0 ? 850 : 1500;
        pollingTimeoutRef.current = setTimeout(() => {
          runReconciliation(retryCount + 1);
        }, delay);
      }
    };

    runReconciliation(0);
  }, [refreshPackageStatus, onSuccessCallback]);

  const handleRetryVerification = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId =
      params.get('session_id') ||
      sessionStorage.getItem('pending_monthly_session_id');

    if (sessionId) {
      // Reset the single-flight guard to allow retry
      processingSessionId.current = null;
      startVerification(sessionId);
    } else {
      setPackageActionError('Không tìm thấy thông tin phiên giao dịch để thử lại.');
    }
  }, [startVerification]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Stripe success URL: ?payment=success&session_id=cs_test_...
    const paymentParam = params.get('payment');
    const sessionId = params.get('session_id');
    // Stripe cancel URL: ?payment=cancelled
    const isCancelled = paymentParam === 'cancelled';
    const isSuccess = paymentParam === 'success';

    console.log('[PaymentReturn] URL params — payment:', paymentParam, 'session_id:', sessionId, 'user:', user?.id);

    if (isCancelled) {
      setPaymentReturnState('IDLE');
      setPackageActionError('Thanh toán đã được hủy. Gói tháng của bạn chưa được kích hoạt.');
      sessionStorage.removeItem('pending_monthly_package_id');
      sessionStorage.removeItem('pending_monthly_payment_id');
      sessionStorage.removeItem('pending_monthly_session_id');
      sessionStorage.removeItem('pending_monthly_plan_id');
      sessionStorage.removeItem('pending_monthly_vehicle_id');
      sessionStorage.removeItem('pending_monthly_checkout_type');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (isSuccess && sessionId) {
      if (!user) {
        // Auth not yet ready — wait for re-render with user
        // Keep URL params so they are still readable on the next render
        console.log('[PaymentReturn] Waiting for user auth before starting verification...');
        return;
      }
      // Start verification — URL is cleaned only after terminal success inside startVerification
      startVerification(sessionId);
      return;
    }

    // No payment=success in URL — nothing to do on this render
  }, [user, startVerification]);

  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);

  return {
    paymentReturnState,
    successDetails,
    packageActionError,
    setPackageActionError,
    packageActionSuccess,
    setPackageActionSuccess,
    handleRetryVerification,
  };
}

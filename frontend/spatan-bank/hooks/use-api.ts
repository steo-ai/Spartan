'use client'

import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import { toast } from './use-toast'

export interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * Generic hook for fetching data from API
 * Usage: const { data, loading, error, refetch } = useApi(api.accounts.getAccounts)
 */
export function useApi<T>(
  fetchFn: () => Promise<T>,
  options: {
    skipInitial?: boolean
    showErrorToast?: boolean
    onSuccess?: (data: T) => void
    onError?: (error: string) => void
  } = {}
) {
  const { skipInitial = false, showErrorToast = false, onSuccess, onError } = options

  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: !skipInitial,
    error: null,
  })

  const fetch = useCallback(async () => {
    setState({ data: null, loading: true, error: null })
    try {
      const result = await fetchFn()
      setState({ data: result, loading: false, error: null })
      onSuccess?.(result)
      return result
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch data'
      setState({ data: null, loading: false, error: errorMessage })
      if (showErrorToast) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
      onError?.(errorMessage)
      throw err
    }
  }, [fetchFn, onSuccess, onError, showErrorToast])

  useEffect(() => {
    if (!skipInitial) {
      fetch()
    }
  }, [fetch, skipInitial])

  return {
    ...state,
    refetch: fetch,
  }
}

/**
 * Hook for handling API mutations (POST, PUT, DELETE)
 * Usage: const { mutate, loading } = useMutation(api.payments.deposit)
 */
export function useMutation<TInput, TOutput>(
  mutationFn: (input: TInput) => Promise<TOutput>,
  options: {
    showSuccessToast?: boolean
    showErrorToast?: boolean
    successMessage?: string
    onSuccess?: (data: TOutput) => void
    onError?: (error: string) => void
  } = {}
) {
  const {
    showSuccessToast = false,
    showErrorToast = true,
    successMessage = 'Operation successful',
    onSuccess,
    onError,
  } = options

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = useCallback(
    async (input: TInput) => {
      setLoading(true)
      setError(null)
      try {
        const result = await mutationFn(input)
        if (showSuccessToast) {
          toast({
            title: 'Success',
            description: successMessage,
          })
        }
        onSuccess?.(result)
        return result
      } catch (err: any) {
        const errorMessage = err.message || 'Operation failed'
        setError(errorMessage)
        if (showErrorToast) {
          toast({
            title: 'Error',
            description: errorMessage,
            variant: 'destructive',
          })
        }
        onError?.(errorMessage)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [mutationFn, onSuccess, onError, showSuccessToast, showErrorToast, successMessage]
  )

  return {
    mutate,
    loading,
    error,
  }
}

/**
 * Safe array handler for API responses that may return paginated results
 */
export function safeArray<T>(data: T[] | { results: T[] } | null | undefined): T[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (data.results && Array.isArray(data.results)) return data.results
  return []
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

import { useState, useEffect, useCallback } from 'react';
import { getErrorMessage } from '../utils';

/**
 * Generic hook for fetching API data with loading/error state management.
 * Automatically fetches on mount and provides a manual refetch function.
 */
export function useApiData<T>(
  fetcher: () => Promise<{ data: T }>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetcher();
      setData(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch, setData };
}

/**
 * Hook for handling async actions (create, update, delete)
 * with loading state and error handling.
 */
export function useApiAction<TArgs extends unknown[], TResult = unknown>(
  action: (...args: TArgs) => Promise<{ data: TResult }>
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setIsLoading(true);
      setError('');
      try {
        const response = await action(...args);
        return response.data;
      } catch (err) {
        setError(getErrorMessage(err));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [action]
  );

  return { execute, isLoading, error, clearError: () => setError('') };
}

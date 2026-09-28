import { useCallback, useEffect, useState } from "react";
import * as api from "../services/api";
import type { TransactionFilters } from "../services/api";
import type { Transaction } from "../types";

export function useTransactions(projectId: number, filters: TransactionFilters) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    return api
      .getTransactions(projectId, filters)
      .then(setTransactions)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, filters.fromDate, filters.toDate, filters.category, filters.limit, filters.offset]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { transactions, loading, refresh };
}

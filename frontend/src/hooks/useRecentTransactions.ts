import { useEffect, useState } from "react";
import * as api from "../services/api";
import type { RecentTransaction } from "../types";

export function useRecentTransactions(limit = 10) {
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getRecentTransactions(limit)
      .then(setTransactions)
      .finally(() => setLoading(false));
  }, [limit]);

  return { transactions, loading };
}

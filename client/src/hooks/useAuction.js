import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  buyAuction,
  getWatchlist,
  toggleWatch,
  getAuctions,
  getMyAuctions,
  getMyBids,
  viewAuction,
  placeBid,
  createAuction,
  dashboardStats,
} from "../services/auction.service.js";

export const useGetAuctions = (page = 1, filters = {}) => {
  return useQuery({
    queryKey: ["auctions", page, filters],
    queryFn: () => getAuctions({ page, ...filters }),
    placeholderData: keepPreviousData,
  });
};

export const useGetWatchlist = (page = 1) => {
  return useQuery({
    queryKey: ["watchlist", page],
    queryFn: () => getWatchlist({ page }),
    placeholderData: keepPreviousData,
  });
};

export const useToggleWatch = (id) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => toggleWatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction", id] });
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
    },
  });
};

export const useBuyAuction = (id) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => buyAuction(id),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
};

export const useGetMyAuctions = (page = 1) => {
  return useQuery({
    queryKey: ["myAuctions", page],
    queryFn: () => getMyAuctions({ page }),
    keepPreviousData: true,
  });
};

export const useGetMyBids = (page = 1) => {
  return useQuery({
    queryKey: ["myBids", page],
    queryFn: () => getMyBids({ page }),
    keepPreviousData: true,
  });
};

export const useViewAuction = (id) => {
  return useQuery({
    queryKey: ["auction", id],
    queryFn: () => viewAuction(id),
    enabled: !!id,
    retry: false,
    // Catches the result even if the socket event was missed
    refetchInterval: (query) => {
      const auction = query.state.data;
      const closing =
        auction &&
        !auction.settledAt &&
        new Date(auction.itemEndDate) <= new Date();
      return closing ? 3000 : false;
    },
  });
};

export const usePlaceBid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bidAmount, maxBid, id }) =>
      placeBid({ bidAmount, maxBid, id }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(["auction", variables.id]);
      queryClient.invalidateQueries(["auctions"]);
      queryClient.invalidateQueries(["myAuctions"]);
      queryClient.invalidateQueries(["myBids"]);
      queryClient.invalidateQueries(["dashboardStats"]);
    },
  });
};

export const useCreateAuction = (options = {}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => createAuction(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries(["auctions"]);
      queryClient.invalidateQueries(["myAuctions"]);
      queryClient.invalidateQueries(["dashboardStats"]);
      options.onSuccess?.(...args);
    },
    onError: options.onError,
  });
};

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ["dashboardStats"],
    queryFn: dashboardStats,
  });
};

// Prefetch helpers
export const usePrefetchHandlers = () => {
  const queryClient = useQueryClient();

  const prefetchAuction = (id) => {
    queryClient.prefetchQuery({
      queryKey: ["auction", id],
      queryFn: () => viewAuction(id),
      staleTime: 30_000,
    });
  };

  const prefetchAuctions = (page = 1) => {
    queryClient.prefetchQuery({
      queryKey: ["auctions", page],
      queryFn: () => getAuctions({ page }),
      staleTime: 30_000,
    });
  };

  const prefetchMyAuctions = (page = 1) => {
    queryClient.prefetchQuery({
      queryKey: ["myAuctions", page],
      queryFn: () => getMyAuctions({ page }),
      staleTime: 30_000,
    });
  };

  const prefetchMyBids = (page = 1) => {
    queryClient.prefetchQuery({
      queryKey: ["myBids", page],
      queryFn: () => getMyBids({ page }),
      staleTime: 30_000,
    });
  };

  const prefetchDashboard = () => {
    queryClient.prefetchQuery({
      queryKey: ["dashboardStats"],
      queryFn: dashboardStats,
      staleTime: 30_000,
    });
  };

  return {
    prefetchAuction,
    prefetchAuctions,
    prefetchMyAuctions,
    prefetchMyBids,
    prefetchDashboard,
  };
};

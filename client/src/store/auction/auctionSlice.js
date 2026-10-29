import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const VITE_API = import.meta.env.VITE_API;

const initialState = {
    auctions: [],
    loading: false,
    error: null,
    userData: null,
    userProducts: [],
    auctionById: null,
};

/* ---------------- HELPERS ---------------- */

const getAuthConfig = () => {
    const token = localStorage.getItem("token");
    return {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    };
};

/* ---------------- THUNKS ---------------- */

export const fetchAuctions = createAsyncThunk(
    'auctions/fetchAuctions',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axios.get(
                `${VITE_API}/auction/show`,
                getAuthConfig()
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data || "Server error"
            );
        }
    }
);

export const fetchUserAndProducts = createAsyncThunk(
    'auctions/fetchUserAndProducts',
    async (userId, { rejectWithValue }) => {
        try {
            const response = await axios.get(
                `${VITE_API}/user/${userId}`,
                getAuthConfig()
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data || "Server error"
            );
        }
    }
);

export const fetchAuctionById = createAsyncThunk(
    'auctions/fetchAuctionById',
    async (productId, { rejectWithValue }) => {
        try {
            const response = await axios.get(
                `${VITE_API}/auction/${productId}`,
                getAuthConfig()
            );
            return response.data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data || "Server error"
            );
        }
    }
);

/* ---------------- SLICE ---------------- */

const auctionSlice = createSlice({
    name: 'auctions',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder

            /* ---- ALL AUCTIONS ---- */
            .addCase(fetchAuctions.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAuctions.fulfilled, (state, action) => {
                state.loading = false;
                state.auctions = action.payload.auctions || [];
            })
            .addCase(fetchAuctions.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            /* ---- USER + PRODUCTS ---- */
            .addCase(fetchUserAndProducts.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUserAndProducts.fulfilled, (state, action) => {
                state.loading = false;
                state.userData = action.payload.user;
                state.userProducts = action.payload.products || [];
            })
            .addCase(fetchUserAndProducts.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            /* ---- SINGLE AUCTION ---- */
            .addCase(fetchAuctionById.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAuctionById.fulfilled, (state, action) => {
                state.loading = false;
                state.auctionById = action.payload.auction;
            })
            .addCase(fetchAuctionById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export default auctionSlice.reducer;
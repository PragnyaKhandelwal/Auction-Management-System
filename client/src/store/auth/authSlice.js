import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { api } from "../../config/api.js";

// Return user if loggedin
export const checkAuth = createAsyncThunk(
  "auth/checkAuth",
  async (_, { rejectWithValue }) => {
    try {
      // Answers 200 for logged-out visitors too, so no console error
      const response = await api.get(`/auth/session`);
      if (!response.data?.user) return rejectWithValue("Not authenticated");
      return response.data;
    } catch {
      return rejectWithValue("Not authenticated");
    }
  },
);

// login
export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      await api.post(`/auth/login`, { email, password });

      const response = await api.get(`/user`);

      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Login failed");
    }
  },
);

// signup
export const signup = createAsyncThunk(
  "auth/signup",
  async ({ name, email, password }, { rejectWithValue }) => {
    try {
      await api.post(`/auth/signup`, { name, email, password });

      const response = await api.get(`/user`);

      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.error || "Signup failed");
    }
  },
);

// sign in with a Google ID token from Google Identity Services
export const googleLogin = createAsyncThunk(
  "auth/googleLogin",
  async (credential, { rejectWithValue }) => {
    try {
      await api.post(`/auth/google`, { credential });

      const response = await api.get(`/user`);

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Google sign-in failed",
      );
    }
  },
);

// logout
export const logout = createAsyncThunk(
  "auth/logout",
  async (_, { rejectWithValue }) => {
    try {
      await api.post(`/auth/logout`, {});
      return null;
    } catch {
      return rejectWithValue("Logout failed");
    }
  },
);

// initial auth state
const initialState = {
  user: null,
  loading: true,
  error: null,
};

// auth slice
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // A Google-only account just set its first password
    passwordSet: (state) => {
      if (state.user?.user) state.user.user.hasPassword = true;
    },
  },
  extraReducers: (builder) => {
    builder
      // checkAuth
      .addCase(checkAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuth.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.loading = false;
      })
      .addCase(checkAuth.rejected, (state, { payload }) => {
        state.user = null;
        state.error = payload;
        state.loading = false;
      })

      // login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.loading = false;
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.user = null;
        state.error = payload;
        state.loading = false;
      })

      // signup
      .addCase(signup.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.loading = false;
      })
      .addCase(signup.rejected, (state, { payload }) => {
        state.user = null;
        state.error = payload;
        state.loading = false;
      })

      // Google sign-in: the button stays on screen, so no full-page loading
      .addCase(googleLogin.pending, (state) => {
        state.error = null;
      })
      .addCase(googleLogin.fulfilled, (state, { payload }) => {
        state.user = payload;
        state.loading = false;
      })
      .addCase(googleLogin.rejected, (state, { payload }) => {
        state.error = payload;
      })

      // logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.loading = false;
        state.error = null;
      })
      .addCase(logout.rejected, (state, { payload }) => {
        state.error = payload;
      });
  },
});

export const { passwordSet } = authSlice.actions;
export default authSlice.reducer;

import { configureStore } from "@reduxjs/toolkit";
import { publicApi } from "./api/publicApi";
// The API instance only, not the ./api/adminApi barrel: the barrel re-exports
// every admin module's endpoints (and supabase-js with them), and the store is
// on every public page. Admin endpoints register themselves when an admin
// page imports them (injectEndpoints), so the store needs none of them.
import { adminApi } from "./api/admin/baseApi";
import learningSessionReducer from "./slices/learningSessionSlice";
import focusReducer from "./slices/focusSlice";

export const store = configureStore({
  reducer: {
    [publicApi.reducerPath]: publicApi.reducer,
    [adminApi.reducerPath]: adminApi.reducer,
    learningSession: learningSessionReducer,
    focus: focusReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(publicApi.middleware)
      .concat(adminApi.middleware),
});

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

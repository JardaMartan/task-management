import { configureStore } from '@reduxjs/toolkit';
import reskillReducer from './store/slices/reskillSlice';

const store = configureStore({
  reducer: {
    reskill: reskillReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    // State is fully serializable; SDK ref is held module-level in the slice.
    serializableCheck: true,
  }),
});

export default store;

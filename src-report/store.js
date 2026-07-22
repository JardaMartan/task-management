import { configureStore } from '@reduxjs/toolkit';
import activityReducer from './store/slices/activitySlice';

const store = configureStore({
  reducer: {
    activity: activityReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    // State is fully serializable; the live-subscription handle is held
    // module-level in the slice.
    serializableCheck: true,
  }),
});

export default store;

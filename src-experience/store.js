import { configureStore } from '@reduxjs/toolkit';
import experienceReducer from './store/slices/experienceSlice';

const store = configureStore({
  reducer: {
    experience: experienceReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    // State is fully serializable; the SDK ref is held module-level in the slice.
    serializableCheck: true,
  }),
});

export default store;

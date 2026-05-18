import axios from 'axios';

// Create an Axios instance configured for the backend API
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true, // Crucial for sending/receiving cookies (like JWT sessions)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Optional: Add interceptors for global error handling (e.g., redirect to login on 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server returns a 401 Unauthorized, we might want to trigger a logout event
    // For now, we just pass the error down to be handled by the specific caller
    return Promise.reject(error);
  }
);

export default api;

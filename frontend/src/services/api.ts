import axios from 'axios';

// Determine the API base URL with a dynamic fallback for production (Vercel)
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // If the app is loaded from any Vercel domain (production or preview), dynamically use the deployed Render API
  if (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('acnerra'))) {
    return 'https://acnerra.onrender.com/api/v1';
  }
  
  // Local development default fallback
  return 'http://localhost:5000/api/v1';
};

// Create an Axios instance configured for the backend API
const api = axios.create({
  baseURL: getBaseURL(),
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

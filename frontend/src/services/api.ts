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

// Add request interceptor to include Authorization header if token exists in localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('acnerra_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for automatic token saving and global 401 state cleanup
api.interceptors.response.use(
  (response) => {
    // If the response contains a token in the body, store it as a fallback
    if (response.data && response.data.token) {
      localStorage.setItem('acnerra_token', response.data.token);
      localStorage.setItem('acnerra_logged_in', 'true');
    }
    return response;
  },
  (error) => {
    // If the server returns a 401 Unauthorized, clear locally stored token/login state
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('acnerra_token');
      localStorage.removeItem('acnerra_logged_in');
    }
    return Promise.reject(error);
  }
);

export default api;

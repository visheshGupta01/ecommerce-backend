import axios from "axios";

let accessToken = null;
let expiresAt = null;

const SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external";

const shiprocket = axios.create({
  baseURL: SHIPROCKET_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

async function login() {
  try {
    const { data } = await axios.post(`${SHIPROCKET_BASE_URL}/auth/login`, {
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    });

    accessToken = data.token;

    // Shiprocket tokens are valid for ~10 days.
    // Refresh a little early.
    expiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || "Failed to authenticate with Shiprocket",
    );
  }
}

shiprocket.interceptors.request.use(async (config) => {
  if (!accessToken || !expiresAt || Date.now() >= expiresAt) {
    await login();
  }

  config.headers.Authorization = `Bearer ${accessToken}`;

  return config;
});

// Retry once if Shiprocket returns 401
shiprocket.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      accessToken = null;
      expiresAt = null;

      await login();

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      return shiprocket(originalRequest);
    }

    return Promise.reject(error);
  },
);

export default shiprocket;

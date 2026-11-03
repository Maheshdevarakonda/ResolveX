// Runs before every test file. Gives the app valid fake settings so env validation passes.
// These are test-only values, not real secrets.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/resolvex-test";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.JWT_ACCESS_SECRET = "test-access-secret-test-access-secret-123";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-test-refresh-secret-123";

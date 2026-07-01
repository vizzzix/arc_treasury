// Circle Iris (attestation) API base. Sandbox serves all testnets;
// override via env for mainnet migration instead of hunting hardcoded URLs.
export const IRIS_API_BASE =
  process.env.IRIS_API_URL?.trim() || 'https://iris-api-sandbox.circle.com/v2';

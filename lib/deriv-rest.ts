import axios from "axios";

const derivRestUrl =
  process.env.NEXT_PUBLIC_DERIV_REST_URL ?? "https://api.derivws.com";

export const derivRestClient = axios.create({
  baseURL: derivRestUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

export async function getAccountInfo(accessToken: string) {
  return derivRestClient.post("/", {
    method: "authorize",
    authorize: accessToken,
    req_id: 1,
  });
}

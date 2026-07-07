export { ONE_YEAR_MS } from "@shared/const";

export const COOKIE_NAME = "pb_session";

// Local login page (email/password auth — no OAuth)
export const getLoginUrl = (_returnPath?: string) => "/login";

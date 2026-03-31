/**
 * Builds headers for API routes that authenticate via getUserFromRequest (see AUTH.md).
 * The Supabase session lives in the browser client (localStorage), not cookies.
 */
export async function bearerAuthHeaders(
  getAccessToken: () => Promise<string | null>,
): Promise<HeadersInit> {
  const token = await getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

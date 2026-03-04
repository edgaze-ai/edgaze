# Cursor + Supabase MCP

This project is configured so Cursor can talk to your Supabase project via the [Model Context Protocol (MCP)](https://supabase.com/docs/guides/getting-started/mcp).

Edgaze is owned and operated by **Edge Platforms, Inc.**, a Delaware C Corporation.

## What’s already done

- **`.cursor/mcp.json`** points Cursor at the hosted Supabase MCP server, scoped to this repo’s project (`project_ref=vbiobyjxhwiyvjqkwosx`).

No API keys or tokens are stored in the repo; auth is done in the browser when you connect.

## Connect Cursor to Supabase

1. **Restart Cursor** (or reload the window) so it picks up `.cursor/mcp.json`.
2. **Open MCP settings**: **Cursor Settings → Tools & MCP** (or **Settings → Cursor Settings → Tools & MCP**).
3. **Sign in when prompted**: Cursor will open a browser window to log in to Supabase and grant the MCP client access to your **organization**. Choose the org that contains this project.
4. **Check the connection**: In **Tools & MCP**, the “supabase” server should show as connected (e.g. green/active).

## What Cursor can do with Supabase

Once connected, you can ask Cursor to:

- **Database**: List tables, run SQL, list migrations, apply migrations, list extensions.
- **Debugging**: Fetch API/Postgres/Auth/Edge Function logs, run security/performance advisors.
- **Development**: Get project URL, get publishable keys, generate TypeScript types from the schema.
- **Edge Functions**: List, read, and deploy Edge Functions.
- **Docs**: Search Supabase docs.

## Optional: read-only mode

To restrict database access to read-only, change the URL in `.cursor/mcp.json` to:

```json
"url": "https://mcp.supabase.com/mcp?project_ref=vbiobyjxhwiyvjqkwosx&read_only=true"
```

## Security

- MCP is intended for **development/testing**. Avoid connecting it to production data.
- The config is scoped to this project only (`project_ref`), so Cursor only sees this project.
- Keep “manually approve tool calls” enabled in Cursor so you review each MCP action before it runs.

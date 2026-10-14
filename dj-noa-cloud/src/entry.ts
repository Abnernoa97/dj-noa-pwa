import { DJ_NOA_CLOUD_SERVICE, DJ_NOA_CLOUD_VERSION } from './identity.ts';

/**
 * Isolated backend staging only.
 * This Worker is NOT imported by DJ NOA's current entrypoint.
 * API operations and OAuth are intentionally disabled until separately
 * provisioned authentication, authorization, and rate-limits exist.
 */
interface DJNoaCloudEnv {
  DJ_NOA_CLOUD_REGISTRY: DurableObjectNamespace;
}

function secureJson(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
      'strict-transport-security': 'max-age=31536000; includeSubDomains'
    }
  });
}

/**
 * Separate SQLite namespace. No public methods read/write cloud data.
 * Account OAuth tokens, file metadata and sync journals will be added only
 * after a session and permission model is in place.
 */
export class DJNoaCloudRegistry {
  constructor(private readonly state: DurableObjectState) {
    this.state.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS cloud_generation (id TEXT PRIMARY KEY, version INTEGER NOT NULL)'
    );
    this.state.storage.sql.exec(
      'INSERT OR IGNORE INTO cloud_generation (id, version) VALUES (?, ?)',
      DJ_NOA_CLOUD_SERVICE, DJ_NOA_CLOUD_VERSION
    );
  }

  async fetch(_request: Request): Promise<Response> {
    return secureJson({ error: 'not_found' }, 404);
  }
}

export default {
  async fetch(request: Request, _env: DJNoaCloudEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return secureJson({
        service: DJ_NOA_CLOUD_SERVICE,
        generation: DJ_NOA_CLOUD_VERSION,
        status: 'setup_required'
      }, 503);
    }
    return secureJson({ error: 'not_found' }, 404);
  }
} satisfies ExportedHandler<DJNoaCloudEnv>;

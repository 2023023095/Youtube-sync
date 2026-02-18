import { handleOptions, sendJson } from './lib/http.js'
import { getStoreStatus } from './lib/store.js'

export default function handler(req, res) {
  if (handleOptions(req, res)) {
    return
  }

  if (req.method !== 'GET') {
    return sendJson(req, res, 405, { error: 'Method not allowed' })
  }

  return sendJson(req, res, 200, {
    ok: true,
    store: getStoreStatus()
  })
}

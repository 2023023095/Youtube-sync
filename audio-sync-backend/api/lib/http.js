const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin'
  )
  res.setHeader('Access-Control-Max-Age', '86400')
}

export const sendJson = (req, res, statusCode, body) => {
  setCorsHeaders(req, res)
  res.status(statusCode).json(body)
}

export const handleOptions = (req, res) => {
  if (req.method !== 'OPTIONS') {
    return false
  }

  setCorsHeaders(req, res)
  res.status(204).end()
  return true
}

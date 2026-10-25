/* 路由表：独立启动（dev-server）与 DSH 宿主两条链路共用的一份。
 *
 * 不抽出来会出现两份实现：本地能开、装进 Desktop 就 404（食管癌那轮踩过）。
 * 这里只依赖 node 内置模块，**不许 import Schemastery**——独立启动时那个 peer 依赖不存在。
 *
 * 鉴权不在这里：宿主链路由 dsh/index.js 先过 connection.requestRejection；
 * 独立启动只有本机回环访问，不需要登录态。
 */

export const API_PREFIX = '/api/gtn'
export const UI_PREFIX = `${API_PREFIX}/ui`

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': buf.length, 'cache-control': 'no-store' })
  res.end(buf)
}

/** 错误 → {status, body}。MinerU 的错因直接透传，但不带 token。 */
function errorBody(error) {
  const code = error?.code
  if (code && typeof code === 'string' && /^[A-Z_]+$/.test(code)) {
    const status = code === 'NO_TOKEN' || code === 'UNAUTHORIZED' ? 503 : 502
    return { status, body: { error: code, message: error.message } }
  }
  if (error?.status === 413) return { status: 413, body: { error: 'too_large', message: error.message } }
  return { status: 500, body: { error: 'internal_error', message: error.message } }
}

function readBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) { reject(Object.assign(new Error('文件超过 30 MB'), { status: 413 })); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/**
 * @param {object} opts
 * @param {{bootstrap(opts?:object):object, db:object}} opts.source
 * @param {string} opts.version
 * @param {string} opts.build
 * @param {(req:object,res:object,path:string)=>boolean} opts.serveUi 静态文件出口（两条链路的 public/ 定位不同）
 * @param {string|null} [opts.workspace] 资料目录（独立启动时 bootstrap 下发给设置页）
 * @param {string|null} [opts.failure] 数据源打不开的原因；非空时除 /health 外一律 503
 */
export function createApiHandler({ source, version, build, serveUi, workspace = null, failure = null }) {
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1')
    const path = url.pathname

    if (path === `${API_PREFIX}/health`) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
      return sendJson(res, 200, {
        ok: !failure, version, build, apiVersion: 'v1', ui: UI_PREFIX, dir: workspace || undefined,
        capabilities: ['bootstrap', 'import', 'candidate', 'mineru-settings'],
        error: failure || undefined,
      })
    }

    /* 数据源打不开：/health 已经报了原因，其它接口统一 503，不假装返回空数据。 */
    const unavailable = (res2) => sendJson(res2, 503, { error: 'bootstrap_unavailable', message: failure })
    if (failure && path !== `${API_PREFIX}/health` && !(path === UI_PREFIX || path.startsWith(`${UI_PREFIX}/`))) return unavailable(res)

    if (path === `${API_PREFIX}/bootstrap`) {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' })
      try {
        return sendJson(res, 200, source.bootstrap({ workspace }))
      } catch (error) {
        const { status, body } = errorBody(error)
        return sendJson(res, status, body)
      }
    }

    /* 导入：原始字节 + 查询串，走 MinerU；只写候选不写记录（候选未核对不入事实层）。 */
    if (path === `${API_PREFIX}/import`) {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      const filename = url.searchParams.get('name') || 'document.pdf'
      const profileKey = url.searchParams.get('profile') || 'lin'
      try {
        const { createImportService } = await import('./import.js')
        const bytes = await readBody(req)
        const service = createImportService(source.db)
        const result = await service.parse(bytes, { filename, profileKey })
        if (url.searchParams.get('persist') === '1') result.record = service.record({ profileKey, document: result.document, candidates: result.candidates })
        /* markdown 全文可能很大：默认不回，需要时加 ?full=1。 */
        return sendJson(res, 200, { ...result, markdown: url.searchParams.get('full') === '1' ? result.markdown : undefined })
      } catch (error) {
        const { status, body } = errorBody(error)
        return sendJson(res, status, body)
      }
    }

    /* 候选核对：accept（入档）/ reject（拒收零副作用）。只改状态，不写记录。 */
    const acceptMatch = path.match(new RegExp(`^${API_PREFIX}/candidate/(\\d+)/(accept|reject)$`))
    if (acceptMatch) {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      try {
        const { ImportService } = await import('./import.js')
        /* 候选核对不需要联网：client=null 只用 review()，不做解析。 */
        const service = new ImportService(source.db, { client: null })
        return sendJson(res, 200, service.review(Number(acceptMatch[1]), acceptMatch[2] === 'accept' ? 'accepted' : 'rejected'))
      } catch (error) {
        const { status, body } = errorBody(error)
        return sendJson(res, status, body)
      }
    }

    /* 文档解析设置：Token 的读取（只给掩码与路径）与手工保存/清除。
       原文永不出现在响应里——界面只需要知道「有没有配、存在哪个文件、哪把 key 生效」。 */
    if (path === `${API_PREFIX}/settings/mineru`) {
      const settings = await import('./settings.js')
      if (req.method === 'GET') {
        try {
          return sendJson(res, 200, settings.mineruSettingsStatus())
        } catch (error) {
          return sendJson(res, 500, { error: 'settings_unavailable', message: error.message })
        }
      }
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' })
      let body = {}
      try {
        const raw = await readBody(req, 64 * 1024)
        body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
      } catch {
        return sendJson(res, 400, { error: 'bad_json', message: '请求体不是合法 JSON' })
      }
      try {
        const status = body?.action === 'clear'
          ? settings.clearMineruToken()
          : settings.saveMineruToken(body?.token)
        return sendJson(res, 200, status)
      } catch (error) {
        /* 校验失败是用户输入问题（400）；文件坏、写不进去是环境问题（500） */
        const status = /请先填写|太短|过长|不能有空格|意外字符|不合法 JSON/.test(error.message) ? 400 : 500
        return sendJson(res, status, { error: status === 400 ? 'invalid_token' : 'settings_write_failed', message: error.message })
      }
    }

    if (path === UI_PREFIX || path.startsWith(`${UI_PREFIX}/`)) {
      return void serveUi(req, res, path.slice(UI_PREFIX.length) || '/')
    }
    return sendJson(res, 404, { error: 'not_found', path })
  }
}

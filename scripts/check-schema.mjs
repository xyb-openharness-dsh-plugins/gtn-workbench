#!/usr/bin/env node
/**
 * 冻结合同校验 + 判读列断言（GTN 版）。
 * 1) schema/ 迁移 sha256 与 freeze-contract.md 逐条比对（缺记录/哈希不符即失败）；
 * 2) 判读列断言：全部 .sql 的列定义里不得出现判读类列名——
 *    diagnosis / risk_level / severity / is_abnormal / is_normal / conclusion / total_score（figo 判定）。
 * 用法：node scripts/check-schema.mjs
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaDir = join(root, 'schema')
const contractPath = join(schemaDir, 'freeze-contract.md')

const FILE_RE = /^\d{4}_[a-z0-9_]+\.sql$/
const ROW_RE = /^\|\s*`?(\d{4}_[a-z0-9_]+\.sql)`?\s*\|\s*([0-9a-f]{64})\s*\|/gm
// 判读列黑名单：列名精确匹配（防"以医生判读冒充数据"）。分类指标原文列（*_text）不在此列。
const BANNED_COLUMNS = new Set([
  'diagnosis', 'risk_level', 'severity', 'is_abnormal', 'is_normal',
  'conclusion', 'total_score', 'risk_group', 'grade_judgement',
])
const COLUMN_RE = /^\s*([a-z0-9_]+)\s+(?:TEXT|INTEGER|REAL|BLOB|NUMERIC|DATE)/im

const files = readdirSync(schemaDir).filter((f) => f.endsWith('.sql'))
const problems = []

for (const file of files) {
  const sql = readFileSync(join(schemaDir, file), 'utf8')
  for (const line of sql.split('\n')) {
    const m = line.match(COLUMN_RE)
    if (m && BANNED_COLUMNS.has(m[1].toLowerCase())) {
      problems.push(`${file}: 判读列断言失败——列名 "${m[1]}" 属于医生判读，不许入数据层`)
    }
  }
}

const unknown = files.filter((f) => !FILE_RE.test(f))
if (unknown.length) problems.push(`schema/ 文件名不合规：${unknown.join(', ')}`)

let contract = ''
try { contract = readFileSync(contractPath, 'utf8') } catch {
  console.error('✗ 缺少 schema/freeze-contract.md'); process.exit(1)
}
const recorded = new Map()
for (const m of contract.matchAll(ROW_RE)) recorded.set(m[1], m[2])

for (const file of files.sort()) {
  const actual = createHash('sha256').update(readFileSync(join(schemaDir, file), 'utf8')).digest('hex')
  const expected = recorded.get(file)
  if (!expected) { problems.push(`${file} 没有冻结记录`); continue }
  if (expected !== actual) problems.push(`${file} 与冻结记录不符（记录 ${expected.slice(0,12)}… 实际 ${actual.slice(0,12)}…）`)
}
for (const f of [...recorded.keys()].filter((f) => !files.includes(f))) {
  problems.push(`freeze-contract.md 记了 ${f}，但 schema/ 里没有`)
}

if (problems.length) {
  console.error('✗ schema 冻结合同被破坏：')
  for (const p of problems) console.error(`  - ${p}`)
  console.error('\n已执行的迁移不能改。要改结构就新增 0002_*.sql 并追加哈希。')
  process.exit(1)
}
console.log(`✓ schema 冻结合同 OK（${files.length} 个迁移）+ 判读列断言 0 违规`)

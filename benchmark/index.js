// @ts-check
import path from 'node:path'
import { parseArgs } from 'node:util'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import Vue from '@vitejs/plugin-vue'
import { build } from 'vite'
import connect from 'connect'
import sirv from 'sirv'
import { launch } from 'puppeteer'
import colors from 'picocolors'
import { exec, getSha } from '../scripts/utils.js'

// Thanks to https://github.com/krausest/js-framework-benchmark (Apache-2.0 license)
const {
  values: {
    skipLib,
    skipApp,
    skipBench,
    vdom,
    noVapor,
    port: portStr,
    count: countStr,
    noHeadless,
    compare,
    compareMode,
  },
} = parseArgs({
  allowNegative: true,
  allowPositionals: true,
  options: {
    skipLib: {
      type: 'boolean',
      short: 'l',
    },
    skipApp: {
      type: 'boolean',
      short: 'a',
    },
    skipBench: {
      type: 'boolean',
      short: 'b',
    },
    noVapor: {
      type: 'boolean',
    },
    vdom: {
      type: 'boolean',
      short: 'v',
    },
    port: {
      type: 'string',
      short: 'p',
      default: '8193',
    },
    count: {
      type: 'string',
      short: 'c',
      default: '50',
    },
    noHeadless: {
      type: 'boolean',
    },
    compare: {
      type: 'string',
      short: 'r',
    },
    compareMode: {
      type: 'string',
    },
  },
})

const port = +(/** @type {string}*/ (portStr))
const count = +(/** @type {string}*/ (countStr))
const sha = await getSha(true)

if (!skipLib && !skipApp && !skipBench) {
  await buildLib()
}
if (!skipApp && !skipBench) {
  await rm('client/dist', { recursive: true }).catch(() => {})
  vdom && (await buildApp(false))
  !noVapor && (await buildApp(true))
}
const server = startServer()

if (!skipBench) {
  await benchmark()
  server.close()
}

if (compare || compareMode === 'vdom-vapor') {
  const compareSha = compare && (await getSha(true, compare))

  let from, to
  switch (compareMode) {
    case 'vdom-vapor':
      from = `${sha}-vapor`
      to = `${sha}-vdom`
      break
    case 'vdom':
      from = `${sha}-vdom`
      to = `${compareSha}-vdom`
      break
    default:
      from = `${sha}-vapor`
      to = `${compareSha}-vapor`
      break
  }

  const fromResult = await readJSON(`results/benchmark-${from}.json`)
  const toResult = await readJSON(`results/benchmark-${to}.json`)
  const diff = Object.fromEntries(
    Object.entries(fromResult).map(([k, v]) => [
      k,
      Object.fromEntries(
        Object.entries(v).map(([kk, vv]) => [kk, vv - toResult[k]?.[kk]]),
      ),
    ]),
  )
  console.log(diff)
}

async function buildLib() {
  console.info(colors.blue('Building lib...'))

  const options = {
    cwd: path.resolve(import.meta.dirname, '..'),
    stdio: 'inherit',
  }
  const [{ ok }, { ok: ok2 }, { ok: ok3 }, { ok: ok4 }] = await Promise.all([
    exec(
      'pnpm',
      'run --silent build shared compiler-core compiler-dom compiler-vapor -pf cjs'.split(
        ' ',
      ),
      options,
    ),
    exec(
      'pnpm',
      'run --silent build compiler-sfc compiler-ssr -f cjs'.split(' '),
      options,
    ),
    exec(
      'pnpm',
      'run --silent build vue-vapor -pf esm-browser'.split(' '),
      options,
    ),
    exec(
      'pnpm',
      'run --silent build vue -pf esm-browser-runtime'.split(' '),
      options,
    ),
  ])

  if (!ok || !ok2 || !ok3 || !ok4) {
    console.error('Failed to build')
    process.exit(1)
  }
}

/** @param {boolean} isVapor */
async function buildApp(isVapor) {
  console.info(
    colors.blue(`\nBuilding ${isVapor ? 'Vapor' : 'Virtual DOM'} app...\n`),
  )

  process.env.NODE_ENV = 'production'
  const CompilerSFC = await import(
    '../packages/compiler-sfc/dist/compiler-sfc.cjs.js'
  )
  /** @type {any} */
  const TemplateCompiler = await import(
    isVapor
      ? '../packages/compiler-vapor/dist/compiler-vapor.cjs.prod.js'
      : '../packages/compiler-dom/dist/compiler-dom.cjs.prod.js'
  )
  const runtimePath = path.resolve(
    import.meta.dirname,
    isVapor
      ? '../packages/vue-vapor/dist/vue-vapor.esm-browser.prod.js'
      : '../packages/vue/dist/vue.runtime.esm-browser.prod.js',
  )

  const mode = isVapor ? 'vapor' : 'vdom'
  await build({
    root: './client',
    base: `/${mode}`,
    define: {
      'import.meta.env.IS_VAPOR': String(isVapor),
    },
    build: {
      minify: 'terser',
      outDir: path.resolve('./client/dist', mode),
      rollupOptions: {
        onwarn(log, handler) {
          if (log.code === 'INVALID_ANNOTATION') return
          handler(log)
        },
      },
    },
    resolve: {
      alias: {
        '@vue/vapor': runtimePath,
        'vue/vapor': runtimePath,
        vue: runtimePath,
      },
    },
    clearScreen: false,
    plugins: [
      Vue({
        compiler: CompilerSFC,
        template: { compiler: TemplateCompiler },
      }),
    ],
  })
}

function startServer() {
  const server = connect().use(sirv('./client/dist')).listen(port)
  console.info(`\n\nServer started at`, colors.blue(`http://localhost:${port}`))
  process.on('SIGTERM', () => server.close())
  return server
}

async function benchmark() {
  console.info(colors.blue(`\nStarting benchmark...`))

  const browser = await initBrowser()

  await mkdir('results', { recursive: true }).catch(() => {})
  if (!noVapor) {
    await doBench(browser, true)
  }
  if (vdom) {
    await doBench(browser, false)
  }

  await browser.close()
}

/**
 * @param {import('puppeteer').Browser} browser
 * @param {boolean} isVapor
 */
async function doBench(browser, isVapor) {
  const mode = isVapor ? 'vapor' : 'vdom'
  console.info('\n\nmode:', mode)

  const page = await browser.newPage()
  await page.goto(`http://localhost:${port}/${mode}`, {
    waitUntil: 'networkidle0',
  })

  await forceGC()
  const t = performance.now()

  for (let i = 0; i < count; i++) {
    await clickButton('run') // test: create rows
    await clickButton('update') // partial update
    await clickButton('swaprows') // swap rows
    await select() // test: select row, remove row
    await clickButton('clear') // clear rows

    await withoutRecord(() => clickButton('run'))
    await clickButton('add') // append rows to large table

    await withoutRecord(() => clickButton('clear'))
    await clickButton('runLots') // create many rows
    await withoutRecord(() => clickButton('clear'))

    // TODO replace all rows
  }

  console.info(
    'Total time:',
    colors.cyan(((performance.now() - t) / 1000).toFixed(2)),
    's',
  )
  const times = await getTimes()
  const result =
    /** @type {Record<string, typeof compute>} */
    Object.fromEntries(Object.entries(times).map(([k, v]) => [k, compute(v)]))

  console.table(result)
  await writeFile(
    `results/benchmark-${sha}-${mode}.json`,
    JSON.stringify(result, undefined, 2),
  )
  await page.close()
  return result

  function getTimes() {
    return page.evaluate(() => /** @type {any} */ (globalThis).times)
  }

  async function forceGC() {
    await page.evaluate(
      `window.gc({type:'major',execution:'sync',flavor:'last-resort'})`,
    )
  }

  /** @param {() => any} fn */
  async function withoutRecord(fn) {
    await page.evaluate(() => (globalThis.recordTime = false))
    await fn()
    await page.evaluate(() => (globalThis.recordTime = true))
  }

  /** @param {string} id */
  async function clickButton(id) {
    await page.click(`#${id}`)
    await wait()
  }

  async function select() {
    for (let i = 1; i <= 10; i++) {
      await page.click(`tbody > tr:nth-child(2) > td:nth-child(2) > a`)
      await page.waitForSelector(`tbody > tr:nth-child(2).danger`)
      await page.click(`tbody > tr:nth-child(2) > td:nth-child(3) > button`)
      await wait()
    }
  }

  async function wait() {
    await page.waitForSelector('.done')
  }
}

async function initBrowser() {
  const disableFeatures = [
    'Translate', // avoid translation popups
    'PrivacySandboxSettings4', // avoid privacy popup
    'IPH_SidePanelGenericMenuFeature', // bookmark popup see https://github.com/krausest/js-framework-benchmark/issues/1688
  ]

  const args = [
    '--js-flags=--expose-gc', // needed for gc() function
    '--no-default-browser-check',
    '--disable-sync',
    '--no-first-run',
    '--ash-no-nudges',
    '--disable-extensions',
    `--disable-features=${disableFeatures.join(',')}`,
  ]

  const headless = !noHeadless
  console.info('headless:', headless)
  const browser = await launch({
    headless: headless,
    args,
  })
  console.log('browser version:', colors.blue(await browser.version()))

  return browser
}

/** @param {number[]} array */
function compute(array) {
  const n = array.length
  const max = Math.max(...array)
  const min = Math.min(...array)
  const mean = array.reduce((a, b) => a + b) / n
  const std = Math.sqrt(
    array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n,
  )
  const median = array.slice().sort((a, b) => a - b)[Math.floor(n / 2)]
  return {
    max: round(max),
    min: round(min),
    mean: round(mean),
    std: round(std),
    median: round(median),
  }
}

/** @param {number} n */
function round(n) {
  return +n.toFixed(2)
}

/** @param {string} filePath */
async function readJSON(filePath) {
  return JSON.parse(await readFile(filePath, 'utf-8'))
}

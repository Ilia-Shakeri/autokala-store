import {spawnSync,spawn} from 'node:child_process'
import {existsSync,readFileSync,mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'

const ROOT=resolve(fileURLToPath(new URL('../',import.meta.url)))
const hash=value=>createHash('sha256').update(value).digest('hex')

export function supportedNode(version=process.versions.node){
  const [major,minor]=version.split('.').map(Number)
  return major>22||(major===22&&minor>=23)
}
export function demoPort(value=process.env.STORE_DEMO_PORT||'3001'){
  if(!/^[1-9]\d{0,4}$/.test(String(value))||Number(value)>65535)throw Error('STORE_DEMO_PORT must be an integer from 1 to 65535.')
  return Number(value)
}
function npmCommand(command,rootDir){
  const result=process.platform==='win32'
    ?spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',`npm.cmd ${command}`],{cwd:rootDir,stdio:'inherit',windowsHide:true})
    :spawnSync('npm',command.split(' '),{cwd:rootDir,stdio:'inherit'})
  if(result.error||result.status!==0)throw Error(`npm ${command} failed. ${result.error?.message||'See the build output above.'}`)
}
export async function sameSite(port,rootDir=ROOT){
  try{
    const base=`http://127.0.0.1:${port}`
    const responses=await Promise.all(['/health/ready','/api/context','/'].map(path=>fetch(base+path,{headers:{Accept:path==='/'?'text/html':'application/json'},signal:AbortSignal.timeout(1500)})))
    if(responses.some(response=>!response.ok))return false
    const [ready,context,html]=await Promise.all([responses[0].json(),responses[1].json(),responses[2].arrayBuffer()])
    return ready.ready===true&&ready.staticBuilt===true&&context.isAdminHost===false&&context.publicOrigin===base&&hash(Buffer.from(html))===hash(readFileSync(resolve(rootDir,'dist/index.html')))
  }catch{return false}
}
function openSite(url,log){
  if(process.platform!=='win32'){log(`Open in your browser: ${url}`);return}
  const child=spawn(process.env.ComSpec||'cmd.exe',['/d','/s','/c',`start "" "${url}"`],{stdio:'ignore',windowsHide:true})
  child.on('error',()=>log(`Open in your browser: ${url}`))
  child.unref()
}
async function listen(server,firstPort,log){
  for(let offset=0;offset<10&&firstPort+offset<=65535;offset++){
    const port=firstPort+offset
    try{
      await new Promise((done,reject)=>{
        const failed=error=>{server.removeListener('listening',ready);reject(error)}
        const ready=()=>{server.removeListener('error',failed);done()}
        server.once('error',failed);server.once('listening',ready);server.listen(port,'127.0.0.1')
      })
      return port
    }catch(error){if(error.code!=='EADDRINUSE')throw error;log(`Port ${port} is busy; trying the next port. No process was stopped.`)}
  }
  throw Error('No free local port found. Set STORE_DEMO_PORT to another port and run again.')
}

export async function runLocal({rootDir=ROOT,port=demoPort(),dbPath=resolve(rootDir,'server/data/store.sqlite'),open=true,build=true,log=console.log}={}){
  if(!supportedNode())throw Error('Node.js 22.23 or newer is required.')
  port=demoPort(port)
  if(build){
    log('[1/3] Checking local dependencies...')
    if(!existsSync(resolve(rootDir,'node_modules/vite/bin/vite.js'))||!existsSync(resolve(rootDir,'node_modules/react/package.json'))){
      log('First run: installing the locked packages. Internet access is required once.')
      npmCommand('ci --registry=https://registry.npmjs.org',rootDir)
    }
    log('[2/3] Building the current site...')
    npmCommand('run build',rootDir)
  }
  if(!existsSync(resolve(rootDir,'dist/index.html')))throw Error('The site build is missing. Run npm.cmd run build.')
  const publicUrl=`http://127.0.0.1:${port}/`
  if(await sameSite(port,rootDir)){
    log('The matching local site is already running. Reusing it; no extra server was started.')
    log(`SHOP: ${publicUrl}`);log(`ADMIN: http://localhost:${port}/`)
    if(open)openSite(publicUrl,log)
    return {reused:true,port,app:null}
  }
  const {createApp}=await import('../server/app.mjs')
  const {seedDemo}=await import('../server/demo.mjs')
  const app=createApp({dbPath,distPath:resolve(rootDir,'dist'),publicHost:'127.0.0.1',adminHost:'localhost',production:false,secureCookies:false,trustProxy:false,allowedOrigins:[]})
  try{
    const marked=app.store.db.prepare('SELECT value FROM meta WHERE key=?').get('demo_content_v1')
    if(!marked&&app.store.settings().demo===true){
      const rows=app.store.db.prepare('SELECT (SELECT COUNT(*) FROM orders)+(SELECT COUNT(*) FROM users) AS count').get().count
      if(rows&&dbPath!==':memory:'){
        const folder=resolve(rootDir,'backups');mkdirSync(folder,{recursive:true})
        const backup=resolve(folder,`before-local-demo-${Date.now()}.sqlite`)
        app.store.db.prepare('VACUUM INTO ?').run(backup)
        log(`A private database backup was saved: ${backup}`)
      }
      const demo=await seedDemo(app.store)
      log(`Sample data ready: ${demo.customers} customers and ${demo.orders} orders. No real payments.`)
    }
    log('[3/3] Starting the local demo...')
    const actualPort=await listen(app.server,port,log)
    if(!(await sameSite(actualPort,rootDir)))throw Error('Local health and build verification failed.')
    log(`SHOP: http://127.0.0.1:${actualPort}/`)
    log(`ADMIN: http://localhost:${actualPort}/`)
    log('Keep this window open. Press Ctrl+C to stop this server. Payment and shipping are placeholders.')
    if(open)openSite(`http://127.0.0.1:${actualPort}/`,log)
    return {reused:false,port:actualPort,app}
  }catch(error){await app.close();throw error}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const args=process.argv.slice(2)
    if(args.some(arg=>arg!=='--no-open'))throw Error('Usage: run.bat [--no-open]')
    const result=await runLocal({open:!args.includes('--no-open')})
    if(result.app){
      let closing=false
      for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{
        if(closing)return;closing=true
        try{await result.app.close();console.log('Local demo stopped.');process.exitCode=0}catch{process.exitCode=1}
      })
    }
  }catch(error){console.error(`DEMO ERROR: ${error.message}`);process.exitCode=1}
}

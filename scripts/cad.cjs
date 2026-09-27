// AI-authored local tool adapter. Every invocation writes separate command/result logs.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const suite = path.resolve(process.env.OSS_CAD_ROOT || path.join(root, 'environment/oss-cad-20260104/oss-cad-suite'));
const win = process.platform === 'win32';
const env = {...process.env, YOSYSHQ_ROOT: suite + path.sep};
const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH';
env[pathKey] = [path.join(suite, 'bin'), path.join(suite, 'lib'), env[pathKey] || ''].join(path.delimiter);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function command(name, args) {
  let exe = path.join(suite, 'bin', name + (win ? '.exe' : ''));
  if (win && name === 'python3') exe = path.join(suite, 'lib', 'python3.exe');
  if (win && name.startsWith('icebox_')) {
    args = [path.join(suite, 'bin', name + '-script.py'), ...args];
    exe = path.join(suite, 'lib', 'python3.exe');
  }
  if (win && name === 'iverilog') args = ['-B', path.join(suite, 'lib', 'ivl'), ...args];
  if (win && name === 'vvp') args = ['-M', '-', '-M', path.join(suite, 'lib', 'ivl'), ...args];
  return {exe, args};
}
function run(name, args, logBase, opts={}) {
  const cmd = command(name,args);
  const cwd = opts.cwd || root;
  const start = new Date().toISOString();
  const r = cp.spawnSync(cmd.exe, cmd.args, {cwd, env, encoding:'utf8', windowsHide:true, timeout:opts.timeout || 180000, maxBuffer:128*1024*1024});
  fs.mkdirSync(path.dirname(logBase), {recursive:true});
  fs.writeFileSync(logBase + '.stdout.log', r.stdout || '');
  fs.writeFileSync(logBase + '.stderr.log', r.stderr || '');
  const record = {started_at:start, ended_at:new Date().toISOString(), cwd, ...cmd, status:r.status, signal:r.signal, error:r.error?.message || null};
  fs.writeFileSync(logBase+'.json',JSON.stringify(record,null,2)+'\n');
  if (r.error || (r.status !== 0 && !opts.allowFailure)) throw new Error(`${name} failed (${r.status}): ${r.error?.message || r.stderr}; see ${logBase}`);
  return {...r, record};
}
module.exports = {root, suite, env, sha, command, run};

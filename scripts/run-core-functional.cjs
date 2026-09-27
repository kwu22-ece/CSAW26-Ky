// Ordinary correctness only: intentionally excludes the modified wrapper.
const fs=require('node:fs');
const path=require('node:path');
const {root,suite,run,sha}=require('./cad.cjs');
const out=path.resolve(process.argv[2]||path.join(root,'evidence/effectiveness-2026-09-26/core-run-01'));
if(fs.existsSync(out)) throw new Error('Refusing to overwrite '+out);
fs.mkdirSync(out,{recursive:true});
const files=['rtl/core.sim.v','rtl/reference_top.v','rtl/cells_sim.v','tb/validation/core_functional_tb.sv'];
const compiled=path.join(out,'core-functional.vvp');
const manifest={started_at:new Date().toISOString(),scope:'Unmodified recovered core functional simulation; no wrapper instantiated',files:files.map(f=>({path:f,sha256:sha(path.join(root,f))})),runs:[]};
const save=()=>fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
save();
try {
  run('iverilog',['-g2012','-s','core_functional_tb','-o',compiled,...files],path.join(out,'01-compile'));
  for(const [label,half] of [['50khz',10000],['1mhz',500]]) {
    const sim=run('vvp',[compiled,`+HALF_NS=${half}`,'+CSV='+path.join(out,label+'.csv'),'+VCD='+path.join(out,label+'.vcd')],path.join(out,'02-'+label));
    const match=sim.stdout.match(/CORE_FUNCTIONAL_PASS vectors=(\d+) inverse_checks=(\d+) short_lengths=(\d+) cycles=(\d+) half_ns=(\d+)/);
    if(!match) throw new Error('No complete pass marker for '+label);
    manifest.runs.push({label,status:'PASS',vectors:+match[1],inverse_checks:+match[2],short_lengths:+match[3],cycles:+match[4],half_ns:+match[5]}); save();
  }
  const bad=run('vvp',[compiled,'+BAD_EXPECT','+CSV='+path.join(out,'negative-control.csv')],path.join(out,'03-negative-control'),{allowFailure:true});
  if(bad.status===0 || !(bad.stdout||'').includes('negative control wrong known answer')) throw new Error('Negative control did not fail as intended');
  manifest.negative_control={status:'EXPECTED_FAIL',exit_status:bad.status};
  manifest.tools=['iverilog','vvp'].map(name=>{const f=path.join(suite,'bin',name+(process.platform==='win32'?'.exe':''));return {name,sha256:sha(f)}});
  manifest.result='PASS';
} catch(e) { manifest.result='FAIL'; manifest.error=e.message; process.exitCode=1; }
manifest.finished_at=new Date().toISOString(); save();
console.log(JSON.stringify({directory:path.relative(root,out),...manifest}));

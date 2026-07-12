const url=process.argv[2]||'https://latea12011-arch.github.io/Property-Security-Company/erp-v2/';
const total=Number(process.argv[3]||1000),concurrency=Number(process.argv[4]||50),timeoutMs=10000;
const latencies=[];let next=0,ok=0,failed=0;const errors=new Map(),started=performance.now();

async function worker(){
  while(true){
    const index=next++;if(index>=total)return;
    const begin=performance.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const response=await fetch(`${url}${url.includes('?')?'&':'?'}load_test=${index}`,{cache:'no-store',signal:controller.signal,headers:{'user-agent':'HongJia-ERP-Authorized-Load-Test/1.0'}});
      await response.arrayBuffer();
      if(response.ok)ok++;else{failed++;errors.set(String(response.status),(errors.get(String(response.status))||0)+1)}
    }catch(error){failed++;const key=error.name||'Error';errors.set(key,(errors.get(key)||0)+1)}
    finally{clearTimeout(timer);latencies.push(performance.now()-begin)}
  }
}

await Promise.all(Array.from({length:concurrency},worker));
latencies.sort((a,b)=>a-b);const percentile=p=>latencies[Math.min(latencies.length-1,Math.floor(latencies.length*p))]||0,duration=(performance.now()-started)/1000;
console.log(JSON.stringify({url,total,concurrency,ok,failed,successRate:`${(ok/total*100).toFixed(2)}%`,durationSeconds:Number(duration.toFixed(2)),requestsPerSecond:Number((total/duration).toFixed(2)),latencyMs:{min:Number((latencies[0]||0).toFixed(1)),p50:Number(percentile(.5).toFixed(1)),p95:Number(percentile(.95).toFixed(1)),p99:Number(percentile(.99).toFixed(1)),max:Number((latencies.at(-1)||0).toFixed(1))},errors:Object.fromEntries(errors)},null,2));

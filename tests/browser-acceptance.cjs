// Run against a local HTML5 export. Gamepad API is simulated; real hardware
// still needs an on-device check. placePlayer is used to isolate bench tests;
// all-platform reachability is separately tested with the actual physics loop.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const levels=JSON.parse(fs.readFileSync('levels.json'));
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    const errors=[], missing=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400 && !r.url().endsWith('favicon.ico'))missing.push(r.url());});
    await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1' ? route.continue() : route.abort());
    await page.addInitScript(()=>{
      window.testPad={id:'Test standard gamepad',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});
    });
    const snap=()=>page.evaluate(()=>window.__makehaven.snapshot());
    const set=async(buttons=[])=>page.evaluate(bs=>{window.testPad.buttons.forEach((b,i)=>{b.pressed=bs.includes(i);b.value=b.pressed?1:0;});},buttons);
    const tap=async n=>{await set([n]);await page.waitForTimeout(90);await set();await page.waitForTimeout(90);};
    const mode=async value=>page.waitForFunction(v=>window.__makehaven?.snapshot().mode===v,value,{timeout:10000});
    const shot=async name=>page.screenshot({path:'docs/screenshots/'+name+'.png'});
    await page.goto('http://127.0.0.1:8093/?test=1');
    await mode('title');await shot('welcome');
    await set([0]);await page.waitForTimeout(650);assert.equal((await snap()).mode,'map');
    await set();await page.waitForTimeout(100);await shot('shop-map');
    console.log('PASS: held gamepad confirm does not skip the map');
    for(let n=0;n<levels.length;n++) {
      const l=levels[n];
      await tap(0);await mode('explore');assert.equal((await snap()).scene,l.scene);
      if(n===0) {
        await tap(9);assert.equal((await snap()).paused,true);
        const before=(await snap()).player.x;await set([15]);await page.waitForTimeout(200);await set();
        assert.equal((await snap()).player.x,before);await tap(9);
        await page.evaluate(()=>{window.testPad.connected=false;});await page.waitForTimeout(120);
        assert.equal((await snap()).disconnected,true);
        await page.evaluate(()=>{window.testPad.connected=true;});await page.waitForTimeout(120);
        assert.equal((await snap()).disconnected,false);
        await set([15]);await page.waitForTimeout(340);await set([15,0]);await page.waitForTimeout(260);await set();await page.waitForTimeout(700);
        assert.ok((await snap()).collected.includes(0),'gamepad jump collects the first real material');
        console.log('PASS: pause, disconnect recovery, gamepad movement and jumping');
      }
      await shot(l.id);
      for(const [x,y,w] of l.platforms) {
        await page.evaluate(([x,y,w])=>window.__makehaven.placePlayer(x+w/2-32,y-72),[x,y,w]);
        await page.waitForTimeout(90);
      }
      assert.equal((await snap()).collected.length,5);
      await page.evaluate(()=>window.__makehaven.placePlayer(1110,570));await page.waitForTimeout(100);
      await tap(2);await mode('bench');await shot(l.id+'-bench');
      if(l.challenge==='assemble' || l.challenge==='pattern') {
        let choice=0;
        for(const target of l.order) {
          while(choice!==target) {await tap(15);choice=(choice+1)%3;}
          await tap(0);
        }
      } else if(l.challenge==='timing') {
        for(let step=0;step<3;step++) {
          await page.waitForFunction(()=>{const p=(Math.sin(window.__makehaven.snapshot().clock*1.8)+1)/2;return p>.43&&p<.57;});
          await tap(0);
          assert.ok((await snap()).step>step);
        }
      } else if(l.challenge==='circuit') {
        await tap(0);await tap(15);await tap(0);
      } else if(l.challenge==='register') {
        for(let step=0;step<3;step++) {
          for(let tries=0;tries<100;tries++) {
            const {offset}=await snap();
            if(Math.abs(offset.x)<=5&&Math.abs(offset.y)<=5)break;
            await set([...(offset.x < -5 ? [15] : offset.x>5 ? [14] : []),...(offset.y < -5 ? [13] : offset.y>5 ? [12] : [])]);
            await page.waitForTimeout(45);
          }
          await set();await page.waitForTimeout(50);await tap(0);
          assert.ok((await snap()).step>step);
        }
      } else if(l.challenge==='focus') {
        for(const target of [45,70,30]) {
          await set([12]);await page.waitForFunction(t=>window.__makehaven.snapshot().focus>=t-3,target);
          await set();await page.waitForTimeout(50);await tap(0);
        }
      }
      await mode('complete');assert.equal((await snap()).badges.length,n+1);
      await shot(l.id+'-complete');
      console.log('PASS: '+l.title+' gathering, bench activity, completion and badge');
      await page.waitForTimeout(700);await tap(0);await mode('map');
    }
    await shot('all-shops-complete');
    await page.evaluate(()=>window.__makehaven.idleFor(75));await page.waitForTimeout(100);await shot('idle-warning');
    await page.evaluate(()=>window.__makehaven.idleFor(91));await mode('title');assert.equal((await snap()).badges.length,0);
    console.log('PASS: idle warning and reset clear the visit');
    assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    console.log('PASS: no runtime errors or missing game assets; external network blocked throughout');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

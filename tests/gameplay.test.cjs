const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const levels = JSON.parse(fs.readFileSync('levels.json'));
const source = fs.readFileSync('scripts/gameplay.js', 'utf8');

function harness(scene = 'Woodshop', session, initialKeys = []) {
  let now = 10000, transition;
  const keys = new Set(initialKeys);
  const game = {_makerSession: session};
  const dummy = new Proxy({}, {get:() => () => {}});
  const runtimeScene = {getGame:()=>game, getName:()=>scene, createObject:()=>dummy};
  class Clock extends Date { static now() {return now;} }
  const context = vm.createContext({runtimeScene, MAKER_LEVELS:levels, Date:Clock,
    navigator: {getGamepads:()=>[]}, window: {}, console,
    gdjs: {evtTools: {input: {isKeyPressed:(_s,k)=>keys.has(k)}, runtimeScene: {replaceScene:(_s,n)=>{transition=n;}}}},
  });
  vm.runInContext(source, context);
  const m = runtimeScene._maker;
  return { ...m, keys, transition:()=>transition, frame(ms=17) {now+=ms;m.tick();},
    press(key) {keys.add(key);now+=17;m.tick();keys.delete(key);now+=17;m.tick();},
    advance(ms) {now+=ms;m.tick();},
  };
}

for(const l of levels) test(`${l.title}: all five material platforms are reachable with real jump physics`, () => {
  const h=harness(l.scene), {state,physics}=h;
  // Reachability is measured independently of the optional roaming hazards.
  state.enemies=[];
  state.movingEnabled=false;
  const surfaces=[[0,642,1280],...l.platforms];
  const reachable=new Set([0]);
  let changed=true;
  while(changed) {
    changed=false;
    for(const from of [...reachable]) for(let to=1;to<surfaces.length;to++) {
      if(reachable.has(to)) continue;
      const [sx,sy,sw]=surfaces[from], [tx,ty,tw]=surfaces[to];
      const goal=tx+tw/2-32;
      // Probe several takeoff points, then steer toward the target center.
      for(const start of [sx+8,sx+sw/2-32,sx+sw-72,Math.max(sx,Math.min(sx+sw-64,goal))]) {
        Object.assign(state.player,{x:start,y:sy-72,vy:0,vx:0,grounded:true,coyote:.1,buffer:.14});
        let landed=false;
        for(let step=0;step<220;step++) {
          state.input={left:state.player.x>goal+2,right:state.player.x<goal-2};
          physics(1/120);
          if(step>3 && state.player.grounded) {
            landed=Math.abs(state.player.y+72-ty)<1 && state.player.x+54>tx && state.player.x+10<tx+tw;
            break;
          }
        }
        if(landed) {reachable.add(to);changed=true;break;}
      }
    }
  }
  assert.equal(reachable.size,surfaces.length, `Unreachable platforms: ${surfaces.map((_,i)=>i).filter(i=>!reachable.has(i))}`);
});

test('holding confirm across title transition cannot skip shop selection', () => {
  const title=harness('Title Screen');title.keys.add('Return');title.frame();
  assert.equal(title.transition(),'Shop Map');
  const map=harness('Shop Map',title.session,['Return']);map.frame();
  assert.equal(map.transition(),undefined);
  map.keys.clear();map.frame();map.press('Return');assert.equal(map.transition(),'Woodshop');
});

test('materials survive rescue; incomplete gathering cannot start making', () => {
  const h=harness();h.state.collected.push(0,1);
  Object.assign(h.state.player,{x:1110,y:570});h.press('e');
  assert.equal(h.state.mode,'explore');
  h.press('r');assert.equal(h.state.collected.length,2);assert.equal(h.state.player.x,65);
});

test('pause stops physics, idle resets the visit and clears badges', () => {
  const h=harness();h.session.badges.push('textiles');h.press('p');
  const x=h.state.player.x;h.keys.add('Right');h.frame(500);
  assert.equal(h.state.player.x,x);assert.equal(h.state.paused,true);
  h.keys.clear();h.frame();h.advance(91000);
  assert.equal(h.transition(),'Title Screen');assert.equal(h.session.badges.length,0);
});

test('wrong assembly choice is forgiving; completion grants exactly one badge', () => {
  const h=harness();h.state.mode='bench';h.state.choice=2;h.press('Space');
  assert.equal(h.state.step,0);
  for(let n=0;n<3;n++) {h.state.choice=n;h.press('Space');}
  assert.equal(h.state.mode,'complete');assert.equal(h.session.badges.length,1);
});

test('fixed step physics remains consistent at 30 and 60 fps', () => {
  const a=harness(),b=harness();
  a.keys.add('Right');b.keys.add('Right');
  for(let n=0;n<60;n++) a.frame(1000/60);
  for(let n=0;n<30;n++) b.frame(1000/30);
  assert.ok(Math.abs(a.state.player.x-b.state.player.x)<=2.6);
});

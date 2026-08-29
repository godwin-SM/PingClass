(function(){
  'use strict';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const lerp=(a,b,t)=>a+(b-a)*t;
  const scenes=[...document.querySelectorAll('.story-section')];
  const targets=new Map(), current=new Map();
  function sceneProgress(el){
    const r=el.getBoundingClientRect(), travel=Math.max(1,el.offsetHeight-window.innerHeight);
    return clamp((-r.top)/travel);
  }
  function update(){
    scenes.forEach(s=>{
      const target=sceneProgress(s);
      targets.set(s,target);
      const p=target;
      current.set(s,p);
      s.style.setProperty('--scene-p',p.toFixed(4));
      if(s.id==='problem'){
        s.querySelectorAll('.chaos-card').forEach((c,i)=>{ const dirs=[[-1.1,-.3],[.9,-.45],[1,.45],[-.8,.55],[.25,-.75]]; const d=dirs[i]||[0,0]; c.style.transform=`translate3d(${lerp(d[0]*110,d[0]*8,p)}px,${lerp(d[1]*90,d[1]*8,p)}px,0) rotate(${lerp((i%2?1:-1)*8,0,p)}deg)`; c.style.opacity=String(lerp(.55,1,p)); });
        const core=s.querySelector('.chaos-core'); if(core){core.style.transform=`translate(-50%,-50%) scale(${lerp(.7,1.1,p)})`;core.style.opacity=String(clamp(p*1.5));}
      }
      if(s.id==='features') s.querySelector('.product-explosion')?.style.setProperty('--p',p);
      if(s.id==='attendance'){const st=s.querySelector('.attendance-stack');if(st)st.style.transform=`translate3d(0,${lerp(70,0,p)}px,0) scale(${lerp(.92,1,p)})`;}
      if(s.id==='fees'){const st=s.querySelector('.payment-visual');if(st)st.style.transform=`translate3d(0,${lerp(80,0,p)}px,0) rotate(${lerp(2,0,p)}deg)`;}
      if(s.id==='roles'){s.querySelectorAll('.role-card').forEach((c,i)=>{const off=[[-140,20],[0,-35],[140,20]][i];c.style.transform=`translate3d(${lerp(off[0],0,p)}px,${lerp(off[1],0,p)}px,0) rotate(${lerp(i===0?-5:i===2?5:0,0,p)}deg)`;c.style.opacity=String(lerp(.35,1,p));});}
    });
    const hero=document.querySelector('.story-hero'); if(hero){const p=clamp(window.scrollY/Math.max(1,hero.offsetHeight)); hero.style.setProperty('--hero-p',p.toFixed(3));}
    updateRail();
  }
  const railLinks=[...document.querySelectorAll('.story-rail a')];
  function updateRail(){
    if(!railLinks.length) return;
    let active=railLinks[0];
    for(const a of railLinks){
      const t=document.querySelector(a.getAttribute('href'));
      if(!t) continue;
      const r=t.getBoundingClientRect();
      if(r.top<=window.innerHeight*0.6 && r.bottom>=window.innerHeight*0.4){active=a;break;}
    }
    railLinks.forEach(a=>a.classList.toggle('is-active',a===active));
  }
  let ticking=false;
  function frame(){
    update();
    if(!reduce) requestAnimationFrame(frame);
  }
  window.addEventListener('scroll',()=>{ticking=true; if(reduce) { update(); ticking=false; }},{passive:true});
  if(!reduce){frame();setTimeout(update,100);} else update();
  const observer=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in-view')}),{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
  document.querySelectorAll('.metric strong[data-count]').forEach(el=>{const target=+el.dataset.count;let done=false;const o=new IntersectionObserver(es=>{if(es[0].isIntersecting&&!done){done=true;let s=0,st=performance.now();function f(t){s=Math.min(target,Math.round(target*((t-st)/900)));el.textContent=s;if(s<target)requestAnimationFrame(f)}requestAnimationFrame(f);o.disconnect();}},{threshold:.5});o.observe(el);});
})();
// ui.js — icons, formatters, badges, toast/modal, charts (presentation layer)
const I={
 dash:'<path d="M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z"/>',
 vendors:'<path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
 rfq:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 13l2 2 4-4"/>',
 quote:'<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 10h8M8 13h5"/>',
 compare:'<path d="M3 6h7v14H3zM14 4h7v16h-7z"/>',
 approve:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
 po:'<path d="M6 2h9l5 5v13a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z"/><path d="M14 2v6h6M9 14l2 2 4-4"/>',
 invoice:'<path d="M4 2h12l4 4v16l-3-2-3 2-3-2-3 2-3-2V2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 activity:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
 reports:'<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>',
 users:'<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13A4 4 0 0119 7"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 check:'<path d="M20 6L9 17l-5-5"/>',
 x:'<path d="M18 6L6 18M6 6l12 12"/>',
 mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
 print:'<path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/>',
 download:'<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
 send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
 edit:'<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 bolt:'<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
 star:'<path d="M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.3 3.2L7 14.2 2 9.4l7-.9z"/>',
 shield:'<path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/>',
 arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 box:'<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/>',
 trend:'<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>'
};
const ic=(n,sz=18,sw=2)=>`<svg class="icn" style="font-size:${sz}px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${I[n]||''}</svg>`;

const $=s=>document.querySelector(s);
const inr=n=>'₹'+new Intl.NumberFormat('en-IN').format(Math.round(n));
const uid=p=>p+Math.random().toString(36).slice(2,7);
const now=()=>new Date();
function fmt(d){d=new Date(d);return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
function ago(d){const s=(Date.now()-new Date(d))/1000;if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago'}
const PAL=['#14B8A6','#3B82F6','#8B5CF6','#F59E0B','#EC4899','#0EA5E9','#10B981','#6366F1'];
function colorFor(s){let h=0;for(const c of s)h=c.charCodeAt(0)+((h<<5)-h);return PAL[Math.abs(h)%PAL.length]}
function initials(n){return n.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()}
function badge(s){const m={Open:'b-open','In Approval':'b-review','Under Review':'b-review',Approved:'b-approved',Rejected:'b-rejected',Completed:'b-completed',Active:'b-active',Pending:'b-pending',Issued:'b-issued',Emailed:'b-emailed',Paid:'b-paid',Draft:'b-draft',Submitted:'b-approved',Invited:'b-pending'};return `<span class="badge ${m[s]||''}"><span class="dot"></span>${s}</span>`}

let TID=0;
function toast(msg,icon='check'){const r=$('#toasts');const t=document.createElement('div');t.className='toast';t.innerHTML=`<span class="t-ic">${ic(icon,15)}</span>${msg}`;r.appendChild(t);const id=++TID;setTimeout(()=>{t.style.transition='.3s';t.style.opacity='0';t.style.transform='translateX(40px)';setTimeout(()=>t.remove(),320)},3200)}
function modal(html){const m=$('#modal');m.innerHTML=`<div class="modal-card">${html}</div>`;m.style.display='flex';m.onclick=e=>{if(e.target===m)closeModal()}}
function closeModal(){$('#modal').style.display='none';$('#modal').innerHTML=''}
function tax(inv){const st=inv.subtotal;const t=st*inv.taxRate/100;return{tax:t,total:st+t}}

function chartArea(vals,labels,color='#0D9488'){
 const W=560,H=200,padL=30,padB=26,maxV=Math.max(...vals,1)*1.18,n=vals.length;
 const x=i=>padL+i*((W-padL-14)/(n-1)),y=v=>H-padB-(v/maxV)*(H-padB-16);
 const pts=vals.map((v,i)=>[x(i),y(v)]);
 const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
 const area=`M${pts[0][0]} ${H-padB} `+pts.map(p=>'L'+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ')+` L${pts[n-1][0]} ${H-padB} Z`;
 let grid='';for(let g=0;g<=3;g++){const gy=16+g*((H-padB-16)/3);grid+=`<line x1="${padL}" y1="${gy}" x2="${W-8}" y2="${gy}" stroke="#EEF2F7"/>`}
 const lab=labels.map((l,i)=>`<text x="${x(i)}" y="${H-8}" font-size="10" fill="#9AACC0" text-anchor="middle">${l}</text>`).join('');
 const dots=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.4" fill="#fff" stroke="${color}" stroke-width="2.4"/>`).join('');
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto"><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#ag)"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linejoin="round"/>${dots}${lab}</svg>`;
}
function chartBars(items){
 const W=560,H=200,padB=30,n=items.length,maxV=Math.max(...items.map(i=>i.value),1)*1.15;
 const bw=(W-20)/n*0.5,gap=(W-20)/n;
 let g='';for(let k=0;k<=3;k++){const gy=14+k*((H-padB-14)/3);g+=`<line x1="6" y1="${gy}" x2="${W-6}" y2="${gy}" stroke="#EEF2F7"/>`}
 const bars=items.map((it,i)=>{const h=(it.value/maxV)*(H-padB-14);const bx=12+i*gap+(gap-bw)/2-6,by=H-padB-h;
  return `<rect x="${bx}" y="${by}" width="${bw}" height="${h}" rx="5" fill="${it.color||'#14B8A6'}"/><text x="${bx+bw/2}" y="${by-6}" font-size="10" font-weight="700" fill="#16263B" text-anchor="middle">${it.short||inr(it.value)}</text><text x="${bx+bw/2}" y="${H-10}" font-size="10" fill="#9AACC0" text-anchor="middle">${it.label}</text>`}).join('');
 return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">${g}${bars}</svg>`;
}
function chartDonut(segs){
 const total=segs.reduce((a,s)=>a+s.value,0)||1,C=2*Math.PI*52;let off=0;
 const rings=segs.map(s=>{const frac=s.value/total,len=frac*C;const r=`<circle cx="80" cy="80" r="52" fill="none" stroke="${s.color}" stroke-width="20" stroke-dasharray="${len.toFixed(1)} ${(C-len).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 80 80)" stroke-linecap="butt"/>`;off+=len;return r}).join('');
 const leg=segs.map(s=>`<div class="flex gap8" style="font-size:12px;margin-bottom:7px"><span style="width:10px;height:10px;border-radius:3px;background:${s.color}"></span><span style="flex:1">${s.label}</span><b>${s.value}</b></div>`).join('');
 return `<div class="flex gap12" style="align-items:center"><svg viewBox="0 0 160 160" style="width:150px;flex:0 0 auto"><circle cx="80" cy="80" r="52" fill="none" stroke="#EEF2F7" stroke-width="20"/>${rings}<text x="80" y="76" font-size="26" font-weight="700" fill="#16263B" text-anchor="middle" font-family="Fraunces,serif">${total}</text><text x="80" y="94" font-size="10" fill="#9AACC0" text-anchor="middle">TOTAL RFQs</text></svg><div style="flex:1">${leg}</div></div>`;
}

window.$=$;

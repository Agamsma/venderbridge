// app.js — VendorBridge SPA: state, store, auth, router, views, workflow
/* ========================================================= DATA STORE */
const DB={vendors:[],rfqs:[],quotes:[],approvals:[],pos:[],invoices:[],activity:[],users:[]};
function vById(id){return DB.vendors.find(v=>v.id===id)}
function rById(id){return DB.rfqs.find(r=>r.id===id)}
function qById(id){return DB.quotes.find(q=>q.id===id)}
function quotesFor(rid){return DB.quotes.filter(q=>q.rfqId===rid)}
function log(){/* audit handled server-side */}
// Real monthly spend for the last 6 months, computed from invoices
function monthlySpend(){
 const lab=[],trend=[],now=new Date();
 for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);lab.push(d.toLocaleString('en-IN',{month:'short'}));
  const sum=DB.invoices.filter(inv=>{const t=new Date(inv.at);return t.getFullYear()===d.getFullYear()&&t.getMonth()===d.getMonth();}).reduce((a,inv)=>a+tax(inv).total,0);
  trend.push(sum/100000);}// in lakhs for a clean axis
 return {lab,trend};
}
async function refresh(){
 const d=await API.get('/api/bootstrap');
 DB.vendors=d.vendors;DB.rfqs=d.rfqs;DB.quotes=d.quotes;DB.approvals=d.approvals;DB.pos=d.pos;DB.invoices=d.invoices;DB.activity=d.activity;DB.users=d.users||[];
 if(S&&S.user){S.user.role=d.me.role;S.user.name=d.me.name;S.user.vendorId=d.me.vendorId;}
}

/* ========================================================= AUTH / SESSION */
const ROLES={
 officer:{label:'Procurement Officer',color:'#14B8A6'},
 vendor:{label:'Vendor Portal',color:'#3B82F6'},
 manager:{label:'Manager / Approver',color:'#8B5CF6'},
 admin:{label:'Administrator',color:'#F59E0B'},
};
const S={user:null,view:'dash',param:null,search:'',vfilter:'All',rfilter:'All',readAt:0};
window.S=S;

function toggleSignup(){
 const su=$('#signup-extra').style.display!=='none';
 $('#signup-extra').style.display=su?'none':'block';
 $('#lg-title').textContent=su?'Welcome back':'Create a vendor account';
 $('#lg-sub').textContent=su?'Sign in to your VendorBridge workspace.':'Register as a vendor to receive RFQs and submit quotations.';
 $('#lg-cta').textContent=su?'Sign in':'Create vendor account';
 $('#lg-switch').innerHTML=su?'Are you a vendor? <a href="#" class="linkish" onclick="toggleSignup();return false">Create an account</a>':'Already have an account? <a href="#" class="linkish" onclick="toggleSignup();return false">Sign in</a>';
}
async function doLogin(){
 const e=$('#lg-email').value.trim(),p=$('#lg-pass').value;
 const signup=$('#signup-extra').style.display!=='none';
 if(signup){
  const name=$('#su-name').value.trim();
  if(!name){toast('Enter your company / contact name.','x');return}
  if(!e||p.length<8){toast('Enter a valid email and a password of at least 8 characters.','x');return}
  try{const r=await API.register({name,email:e,password:p,category:$('#su-cat').value});await afterLogin(r.user);}
  catch(err){toast(err.message,'x')}
  return;
 }
 if(!e||!p){toast('Please enter your email and password.','x');return}
 await loginWith(e,p);
}
async function loginWith(email,password){
 try{const r=await API.login(email,password);await afterLogin(r.user);}
 catch(err){toast(err.message||'Sign in failed','x');}
}
async function afterLogin(user){
 const meta=ROLES[user.role]||{label:user.role,color:'#14B8A6'};
 S.user={role:user.role,name:user.name,vendorId:user.vendorId,label:meta.label,color:meta.color};
 $('#login').style.display='none';$('#app').style.display='grid';
 $('#sb-ava').style.background=meta.color;$('#sb-ava').textContent=initials(user.name);
 $('#sb-name').textContent=user.name;$('#sb-role').textContent=meta.label;
 $('#cta-btn').innerHTML=user.role==='vendor'?ic('quote',15)+' Submit Quote':ic('plus',15)+' New RFQ';
 $('#cta-btn').onclick=()=>go(user.role==='vendor'?'quotes':'rfq-new');
 try{await refresh();}catch(e){toast(e.message,'x');}
 buildNav();go('dash');updateNotif();
 toast('Signed in as '+meta.label,'check');
}
function logout(){API.clearToken();S.user=null;$('#app').style.display='none';$('#login').style.display='grid';$('#dd').style.display='none';}

/* ========================================================= NAV */
const NAV={
 officer:['dash','rfqs','vendors','approvals','pos','invoices','activity','reports'],
 vendor:['dash','quotes','myrfqs','mypos','activity'],
 manager:['dash','approvals','rfqs','activity','reports'],
 admin:['dash','rfqs','vendors','users','pos','invoices','activity','reports'],
};
const NAVMETA={
 dash:['dash','Dashboard'],rfqs:['rfq','RFQs'],vendors:['vendors','Vendors'],approvals:['approve','Approvals'],
 pos:['po','Purchase Orders'],invoices:['invoice','Invoices'],activity:['activity','Activity Log'],reports:['reports','Reports & Analytics'],
 quotes:['quote','Open RFQs'],myrfqs:['rfq','My Quotations'],mypos:['po','My Orders'],users:['users','User Management'],
};
function navBadge(k){
 if(k==='approvals')return DB.approvals.filter(a=>a.state==='Under Review').length||'';
 if(k==='quotes'&&S.user.role==='vendor'){const vid=S.user.vendorId;return DB.rfqs.filter(r=>r.status==='Open'&&r.vendors.includes(vid)&&!DB.quotes.some(q=>q.rfqId===r.id&&q.vendorId===vid)).length||''}
 if(k==='rfqs')return DB.rfqs.filter(r=>r.status==='Open').length||'';
 return '';
}
function buildNav(){
 const keys=NAV[S.user.role];
 $('#nav').innerHTML='<div class="sb-sec">Menu</div>'+keys.map(k=>{
  const[icn,lbl]=NAVMETA[k];const b=navBadge(k);
  return `<a class="nav-i" data-v="${k}" onclick="go('${k}')">${ic(icn,17)}<span class="tx">${lbl}</span>${b?`<span class="ct">${b}</span>`:''}</a>`;
 }).join('');
}
function setActive(){document.querySelectorAll('.nav-i').forEach(n=>n.classList.toggle('on',n.dataset.v===S.view||(S.view.startsWith('rfq')&&n.dataset.v==='rfqs')))}


/* ========================================================= ROUTER */
function go(view,param){
 S.view=view;S.param=param??null;
 setActive();$('#dd').style.display='none';
 const m=$('#main');m.scrollTop=0;
 const map={dash:vDash,rfqs:vRFQs,'rfq-new':vRFQNew,rfq:vRFQ,vendors:vVendors,approvals:vApprovals,
  pos:vPOs,invoices:vInvoices,activity:vActivity,reports:vReports,quotes:vQuotes,myrfqs:vMyRFQs,mypos:vMyPOs,users:vUsers};
 m.innerHTML=`<div class="fade-in">${(map[view]||vDash)()}</div>`;
 buildNav();setActive();
}
function head(eyebrow,title,sub,actions){return `<div class="page-head"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${sub?`<p>${sub}</p>`:''}</div>${actions?`<div class="head-actions">${actions}</div>`:''}</div>`}
function empty(txt){return `<div class="empty"><div class="e-ic">${ic('box',24)}</div>${txt}</div>`}

/* ========================================================= DASHBOARD */
function statCard(icn,bg,val,lbl,trend){return `<div class="stat"><div class="ic" style="background:${bg}">${ic(icn,19)}</div><div class="val mono">${val}</div><div class="lbl">${lbl}</div>${trend?`<span class="trend ${trend[0]==='-'?'tr-dn':'tr-up'}">${trend}</span>`:''}</div>`}
function spend(){return DB.invoices.reduce((a,i)=>a+tax(i).total,0)}

function vDash(){
 const r=S.user.role;
 if(r==='vendor')return vDashVendor();
 if(r==='manager')return vDashManager();
 const openR=DB.rfqs.filter(x=>x.status==='Open').length;
 const inApp=DB.approvals.filter(a=>a.state==='Under Review').length;
 const newQ=DB.quotes.filter(q=>rById(q.rfqId).status==='Open').length;
 const {trend,lab}=monthlySpend();
 const cats={};DB.invoices.forEach(i=>{const v=vById(i.vendorId);cats[v.cat]=(cats[v.cat]||0)+tax(i).total});
 return head('Overview','Good to see you, '+S.user.name.split(' ')[0],'Here\u2019s what your procurement pipeline looks like right now.',
   `<button class="btn" onclick="go('reports')">${ic('reports',15)} Reports</button><button class="btn btn-primary" onclick="go('rfq-new')">${ic('plus',15)} New RFQ</button>`)
 +`<div class="grid g4 stagger mb16">
   ${statCard('rfq','#3B82F6',openR,'Active RFQs')}
   ${statCard('clock','#F59E0B',inApp,'Pending Approvals')}
   ${statCard('quote','#8B5CF6',newQ,'Quotes to Compare')}
   ${statCard('trend','#14B8A6',inr(spend()),'Procurement Spend')}
  </div>
  <div class="grid" style="grid-template-columns:1.6fr 1fr">
   <div class="card"><div class="card-h"><div class="ttl"><span class="mini-ic" style="background:#3B82F6">${ic('rfq',16)}</span><h3>Active RFQs</h3></div><a class="linkish" style="font-size:13px;cursor:pointer" onclick="go('rfqs')">View all →</a></div>
    <table class="tbl"><thead><tr><th>RFQ</th><th>Quotes</th><th>Deadline</th><th>Status</th><th></th></tr></thead><tbody>
    ${DB.rfqs.filter(x=>x.status!=='Completed').map(rfqRow).join('')}
    </tbody></table></div>
   <div class="card card-pad"><div class="spread mb16"><div class="ttl flex gap8"><span class="mini-ic" style="background:#14B8A6">${ic('trend',16)}</span><h3 style="font-family:var(--font-display);font-size:16px">Monthly Spend</h3></div></div>
    ${chartArea(trend,lab)}<div class="muted" style="font-size:12px;margin-top:10px">Spend over the last six months (in ₹ lakh), generated from approved invoices.</div></div>
  </div>
  <div class="grid g2 mt16">
   <div class="card"><div class="card-h"><div class="ttl"><span class="mini-ic" style="background:#8B5CF6">${ic('activity',16)}</span><h3>Recent Activity</h3></div><a class="linkish" style="font-size:13px;cursor:pointer" onclick="go('activity')">All →</a></div><div class="card-pad">${activityList(5)}</div></div>
   <div class="card card-pad"><h3 style="font-family:var(--font-display);font-size:16px;margin-bottom:14px">Spend by Category</h3>${chartBars(Object.entries(cats).map(([l,v],i)=>({label:l,value:v,color:PAL[i%PAL.length],short:inr(v)})))}</div>
  </div>`;
}
function vDashManager(){
 const pend=DB.approvals.filter(a=>a.state==='Under Review');
 const appr=DB.approvals.filter(a=>a.state==='Approved').length;
 const rej=DB.approvals.filter(a=>a.state==='Rejected').length;
 return head('Approvals desk','Welcome, '+S.user.name.split(' ')[0],'Decisions waiting on you, and the procurement value flowing through.')
 +`<div class="grid g4 stagger mb16">
   ${statCard('clock','#F59E0B',pend.length,'Awaiting Your Decision')}
   ${statCard('check','#14B8A6',appr,'Approved')}
   ${statCard('x','#E11D48',rej,'Rejected')}
   ${statCard('trend','#3B82F6',inr(spend()),'Approved Value')}
  </div>
  <div class="card"><div class="card-h"><div class="ttl"><span class="mini-ic" style="background:#F59E0B">${ic('approve',16)}</span><h3>Pending Approvals</h3></div></div>
   ${pend.length?`<table class="tbl"><thead><tr><th>RFQ</th><th>Recommended Vendor</th><th>Value</th><th>Submitted</th><th></th></tr></thead><tbody>${pend.map(approvalRow).join('')}</tbody></table>`:empty('Nothing pending — you\u2019re all caught up.')}</div>
  <div class="grid g2 mt16">
   <div class="card card-pad"><h3 style="font-family:var(--font-display);font-size:16px;margin-bottom:14px">RFQ Pipeline</h3>${chartDonut(rfqStatusSegs())}</div>
   <div class="card"><div class="card-h"><div class="ttl"><span class="mini-ic" style="background:#8B5CF6">${ic('activity',16)}</span><h3>Recent Activity</h3></div></div><div class="card-pad">${activityList(5)}</div></div>
  </div>`;
}
function vDashVendor(){
 const vid=S.user.vendorId;
 const open=DB.rfqs.filter(r=>r.status==='Open'&&r.vendors.includes(vid));
 const toQuote=open.filter(r=>!DB.quotes.some(q=>q.rfqId===r.id&&q.vendorId===vid));
 const myQ=DB.quotes.filter(q=>q.vendorId===vid);
 const myPO=DB.pos.filter(p=>p.vendorId===vid);
 const earnings=DB.invoices.filter(i=>i.vendorId===vid).reduce((a,i)=>a+tax(i).total,0);
 return head('Vendor portal',S.user.name,'Respond to invitations, track your quotations, and see your awarded orders.')
 +`<div class="grid g4 stagger mb16">
   ${statCard('quote','#3B82F6',toQuote.length,'New Invitations')}
   ${statCard('rfq','#8B5CF6',myQ.length,'Quotations Submitted')}
   ${statCard('box','#14B8A6',myPO.length,'Orders Awarded')}
   ${statCard('trend','#F59E0B',inr(earnings),'Revenue Booked')}
  </div>
  <div class="card"><div class="card-h"><div class="ttl"><span class="mini-ic" style="background:#3B82F6">${ic('quote',16)}</span><h3>Open RFQ Invitations</h3></div><a class="linkish" style="font-size:13px;cursor:pointer" onclick="go('quotes')">View all →</a></div>
   ${open.length?`<table class="tbl"><thead><tr><th>RFQ</th><th>Requirement</th><th>Deadline</th><th>Status</th><th></th></tr></thead><tbody>${open.map(r=>vendorRFQRow(r,vid)).join('')}</tbody></table>`:empty('No open invitations right now.')}</div>`;
}
function rfqStatusSegs(){const c={Open:0,'In Approval':0,Completed:0};DB.rfqs.forEach(r=>c[r.status]!==undefined&&c[r.status]++);return[{label:'Open',value:c.Open,color:'#3B82F6'},{label:'In Approval',value:c['In Approval'],color:'#F59E0B'},{label:'Completed',value:c.Completed,color:'#14B8A6'}]}

/* row builders */
function rfqRow(r){const qs=quotesFor(r.id);return `<tr style="cursor:pointer" onclick="go('rfq','${r.id}')"><td><div class="strong">${r.code}</div><div class="sub">${r.title}</div></td><td><b>${qs.length}</b> <span class="sub">/ ${r.vendors.length}</span></td><td class="mono">${fmt(r.deadline)}</td><td>${badge(r.status)}</td><td class="rt">${ic('arrow',16)}</td></tr>`}
function approvalRow(a){const r=rById(a.rfqId),q=qById(a.quoteId),v=vById(q.vendorId);return `<tr><td><div class="strong">${r.code}</div><div class="sub">${r.title}</div></td><td><div class="cellrow"><span class="av-sq" style="background:${colorFor(v.name)}">${initials(v.name)}</span><div><div class="strong" style="font-size:13px">${v.name}</div><div class="sub">${q.days}-day delivery</div></div></div></td><td class="strong mono">${inr(q.price*r.qty)}</td><td class="sub">${ago(a.at)}</td><td class="rt"><button class="btn btn-primary btn-sm" onclick="decideModal('${a.id}')">Review</button></td></tr>`}
function vendorRFQRow(r,vid){const q=DB.quotes.find(x=>x.rfqId===r.id&&x.vendorId===vid);return `<tr><td><div class="strong">${r.code}</div><div class="sub">${r.title}</div></td><td class="sub">${r.qty} ${r.unit}</td><td class="mono">${fmt(r.deadline)}</td><td>${q?badge('Submitted'):badge('Invited')}</td><td class="rt"><button class="btn ${q?'':'btn-primary'} btn-sm" onclick="quoteModal('${r.id}')">${q?'Edit Quote':'Submit Quote'}</button></td></tr>`}


/* ========================================================= RFQs */
function vRFQs(){
 const f=S.rfilter,s=S.search.toLowerCase();
 let list=DB.rfqs.filter(r=>f==='All'||r.status===f);
 if(s)list=list.filter(r=>(r.code+r.title+r.details).toLowerCase().includes(s));
 const chips=['All','Open','In Approval','Completed'].map(c=>`<button class="chip ${f===c?'on':''}" onclick="S.rfilter='${c}';go('rfqs')">${c}</button>`).join('');
 return head('Procurement','Requests for Quotation','Create requests, invite vendors, and compare what comes back.',
   `<button class="btn btn-primary" onclick="go('rfq-new')">${ic('plus',15)} New RFQ</button>`)
 +`<div class="card"><div class="card-h"><div class="filters">${chips}</div><span class="sub">${list.length} RFQ${list.length!==1?'s':''}</span></div>
   ${list.length?`<table class="tbl"><thead><tr><th>RFQ</th><th>Requirement</th><th>Vendors</th><th>Quotes In</th><th>Deadline</th><th>Status</th><th></th></tr></thead><tbody>
   ${list.map(r=>{const qs=quotesFor(r.id);return `<tr style="cursor:pointer" onclick="go('rfq','${r.id}')"><td class="strong">${r.code}</td><td><div class="strong" style="font-weight:600">${r.title}</div><div class="sub">${r.qty} ${r.unit}</div></td><td class="sub">${r.vendors.length} invited</td><td><b>${qs.length}</b></td><td class="mono">${fmt(r.deadline)}</td><td>${badge(r.status)}</td><td class="rt">${ic('arrow',16)}</td></tr>`}).join('')}
   </tbody></table>`:empty('No RFQs match this filter.')}</div>`;
}
function vRFQNew(){
 return head('Procurement','Create RFQ','Define what you need and invite the vendors who should respond.',
   `<button class="btn" onclick="go('rfqs')">Cancel</button>`)
 +`<div class="grid" style="grid-template-columns:1.5fr 1fr">
   <div class="card card-pad">
    <div class="field"><label>RFQ Title</label><input id="f-title" placeholder="e.g. Q3 Laptop Refresh"></div>
    <div class="field"><label>Product / Service Details</label><textarea id="f-details" placeholder="Describe specifications, models, requirements…"></textarea></div>
    <div class="row"><div class="field"><label>Quantity</label><input id="f-qty" type="number" value="10"></div><div class="field"><label>Unit</label><input id="f-unit" value="units"></div><div class="field"><label>Deadline</label><input id="f-deadline" type="date"></div></div>
    <div class="field"><label>Attachments</label><div class="flex gap8"><span class="badge b-open" style="padding:6px 11px">${ic('rfq',13)} spec_sheet.pdf</span><span class="sub">Optional · drag &amp; drop or browse</span></div></div>
   </div>
   <div class="card card-pad">
    <label style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted)">Invite Vendors</label>
    <div class="hint" style="margin:4px 0 12px;font-size:11.5px;color:var(--muted-2)">Select who should receive this request.</div>
    <div id="vpick">${DB.vendors.filter(v=>v.status==='Active').map((v,idx)=>`<label class="flex gap8" style="padding:9px 0;border-bottom:1px solid var(--border-2);cursor:pointer"><input type="checkbox" value="${v.id}" ${idx<3?'checked':''} style="width:16px;height:16px;accent-color:var(--teal)"><span class="av-sq" style="background:${colorFor(v.name)};width:30px;height:30px">${initials(v.name)}</span><span style="flex:1"><b style="font-size:13px">${v.name}</b><div class="sub">${v.cat}</div></span></label>`).join('')}</div>
    <button class="btn btn-primary mt16" style="width:100%;justify-content:center;padding:12px" onclick="createRFQ()">${ic('send',15)} Publish RFQ to Vendors</button>
   </div>
  </div>`;
}
function createRFQ(){(async()=>{
 const title=$('#f-title').value.trim();if(!title){toast('Give your RFQ a title first.','x');return}
 const vendorIds=[...document.querySelectorAll('#vpick input:checked')].map(i=>i.value);
 if(!vendorIds.length){toast('Invite at least one vendor.','x');return}
 try{const r=await API.post('/api/rfqs',{title,details:$('#f-details').value||'',quantity:+$('#f-qty').value||1,unit:$('#f-unit').value||'units',deadline:$('#f-deadline').value||null,vendorIds});
  await refresh();toast(r.code+' published to '+vendorIds.length+' vendor(s).','send');go('rfq',String(r.id));
 }catch(e){toast(e.message,'x')}
})()}
function vRFQ(){
 const r=rById(S.param);if(!r)return vRFQs();
 const qs=quotesFor(r.id).slice().sort((a,b)=>a.price-b.price);
 const lowest=qs[0];
 const vendorChips=r.vendors.map(vid=>{const v=vById(vid);const has=qs.some(q=>q.vendorId===vid);return `<span class="badge ${has?'b-approved':'b-pending'}" style="margin:0 6px 6px 0"><span class="dot"></span>${v.name} ${has?'· quoted':'· awaiting'}</span>`}).join('');
 const sort=S.qsort||'price';
 const sorted=qs.slice().sort((a,b)=>sort==='price'?a.price-b.price:sort==='days'?a.days-b.days:vById(b.vendorId).rating-vById(a.vendorId).rating);
 const canApprove=r.status==='Open'&&qs.length>0&&(S.user.role==='officer'||S.user.role==='admin');
 const ap=DB.approvals.find(a=>a.rfqId===r.id);
 return head('RFQ · '+r.code,r.title,r.details,`<button class="btn" onclick="go('rfqs')">← All RFQs</button>`)
 +`<div class="grid g4 mb16">
   <div class="card card-pad"><div class="sub">Status</div><div class="mt16">${badge(r.status)}</div></div>
   <div class="card card-pad"><div class="sub">Quantity</div><div class="val mono" style="font-family:var(--font-display);font-size:22px;font-weight:600">${r.qty} <span style="font-size:13px;color:var(--muted)">${r.unit}</span></div></div>
   <div class="card card-pad"><div class="sub">Deadline</div><div class="mono" style="font-weight:700;font-size:16px;margin-top:6px">${fmt(r.deadline)}</div></div>
   <div class="card card-pad"><div class="sub">Quotes Received</div><div class="val mono" style="font-family:var(--font-display);font-size:22px;font-weight:600">${qs.length} <span style="font-size:13px;color:var(--muted)">/ ${r.vendors.length}</span></div></div>
  </div>
  <div class="card mb16"><div class="card-pad"><div class="sub" style="font-weight:700;margin-bottom:8px">INVITED VENDORS</div>${vendorChips}</div></div>
  ${qs.length?`
  <div class="card"><div class="card-h"><div class="ttl"><span class="mini-ic" style="background:#14B8A6">${ic('compare',16)}</span><h3>Quotation Comparison</h3></div>
    <div class="filters"><span class="sub" style="margin-right:4px">Sort by</span>
     ${['price|Price','days|Delivery','rating|Rating'].map(o=>{const[k,l]=o.split('|');return `<button class="chip ${sort===k?'on':''}" onclick="S.qsort='${k}';go('rfq','${r.id}')">${l}</button>`}).join('')}</div></div>
   <div class="card-pad">${comparison(r,sorted,lowest)}
   ${qs.length&&lowest?`<div class="card-pad" style="background:var(--teal-soft);border-radius:12px;margin-top:16px;border:1px solid var(--teal-line)"><div class="flex gap12"><span class="mini-ic" style="background:var(--teal)">${ic('trend',16)}</span><div style="flex:1"><b>${vById(lowest.vendorId).name}</b> offers the lowest unit price at <b>${inr(lowest.price)}</b> — total <b>${inr(lowest.price*r.qty)}</b> for ${r.qty} ${r.unit}.</div>
    ${canApprove?`<button class="btn btn-primary" onclick="sendApprovalModal('${r.id}')">${ic('approve',15)} Send for Approval</button>`:r.status==='In Approval'?`<span class="badge b-review"><span class="dot"></span>Awaiting Approval</span>`:r.status==='Completed'?`<span class="badge b-completed"><span class="dot"></span>Completed</span>`:''}</div></div>`:''}</div></div>`
  :empty('No quotations submitted yet. Vendors have been invited.')}
  ${ap&&ap.state!=='Under Review'?`<div class="card card-pad mt16"><div class="ttl flex gap8 mb16"><span class="mini-ic" style="background:#8B5CF6">${ic('approve',16)}</span><h3 style="font-family:var(--font-display);font-size:16px">Approval Record</h3></div><div class="flex gap12"><div>${badge(ap.state)}</div><div class="sub">by <b>${ap.by}</b> · ${fmt(ap.at)}</div></div>${ap.remark?`<div style="margin-top:10px;font-style:italic;color:var(--text)">"${ap.remark}"</div>`:''}</div>`:''}`;
}
function comparison(r,sorted,lowest){
 const rows=[['Unit Price',q=>inr(q.price),q=>q.id===lowest.id],['Delivery',q=>q.days+' days',q=>q.days===Math.min(...sorted.map(x=>x.days))],['Vendor Rating',q=>vById(q.vendorId).rating+' ★',q=>vById(q.vendorId).rating===Math.max(...sorted.map(x=>vById(x.vendorId).rating))],['Total ('+r.qty+')',q=>inr(q.price*r.qty),q=>q.id===lowest.id],['Notes',q=>`<span style="font-size:11.5px;color:var(--muted)">${q.notes||'—'}</span>`,()=>false]];
 let h='<div style="overflow-x:auto"><table class="cmp"><thead><tr><th class="lbl-cell"></th>';
 sorted.forEach(q=>{const v=vById(q.vendorId);const win=q.id===lowest.id;h+=`<th class="vh ${win?'win':''}">${v.name}${win?'<span class="best-tag">★ BEST</span>':''}</th>`});
 h+='</tr></thead><tbody>';
 rows.forEach(([lbl,val,winFn])=>{h+=`<tr><td class="lbl-cell">${lbl}</td>`;sorted.forEach(q=>{h+=`<td class="${winFn(q)?'win':''}">${val(q)}</td>`});h+='</tr>'});
 h+='</tbody></table></div>';return h;
}

/* ========================================================= VENDORS */
function vVendors(){
 const s=S.search.toLowerCase();let list=DB.vendors.filter(v=>!s||(v.name+v.cat+v.gst).toLowerCase().includes(s));
 const f=S.vfilter;if(f!=='All')list=list.filter(v=>v.status===f);
 const chips=['All','Active','Pending'].map(c=>`<button class="chip ${f===c?'on':''}" onclick="S.vfilter='${c}';go('vendors')">${c}</button>`).join('');
 return head('Network','Vendor Management','Your living directory of suppliers — categories, GST, contacts and status.',
   `<button class="btn btn-primary" onclick="vendorModal()">${ic('plus',15)} Add Vendor</button>`)
 +`<div class="card"><div class="card-h"><div class="filters">${chips}</div><span class="sub">${list.length} vendors</span></div>
   <table class="tbl"><thead><tr><th>Vendor</th><th>Category</th><th>GST</th><th>Contact</th><th>Rating</th><th>Status</th></tr></thead><tbody>
   ${list.map(v=>`<tr><td><div class="cellrow"><span class="av-sq" style="background:${colorFor(v.name)}">${initials(v.name)}</span><div class="strong">${v.name}</div></div></td><td class="sub">${v.cat}</td><td class="sub mono">${v.gst}</td><td class="sub">${v.email}<br>${v.phone}</td><td><b>${v.rating}</b> <span style="color:#F59E0B">★</span></td><td>${badge(v.status)}</td></tr>`).join('')}
   </tbody></table></div>`;
}
function vendorModal(){
 modal(`<div class="modal-h"><div><h3>Add Vendor</h3><p>Register a new supplier into the directory.</p></div><button class="x-btn" onclick="closeModal()">${ic('x',16)}</button></div>
 <div class="modal-b"><div class="field"><label>Vendor Name</label><input id="nv-name" placeholder="Company name"></div>
  <div class="row"><div class="field"><label>Category</label><select id="nv-cat"><option>IT Hardware</option><option>Office Supplies</option><option>Electronics</option><option>Networking</option><option>Furniture</option><option>Services</option></select></div><div class="field"><label>GST Number</label><input id="nv-gst" placeholder="22AAAAA0000A1Z5"></div></div>
  <div class="row"><div class="field"><label>Email</label><input id="nv-email" placeholder="sales@vendor.in"></div><div class="field"><label>Phone</label><input id="nv-phone" placeholder="+91 …"></div></div></div>
 <div class="modal-f"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveVendor()">Save Vendor</button></div>`);
}
function saveVendor(){(async()=>{const n=$('#nv-name').value.trim();if(!n){toast('Vendor name is required.','x');return}
 try{await API.post('/api/vendors',{name:n,category:$('#nv-cat').value,gst:$('#nv-gst').value||null,email:$('#nv-email').value||null,phone:$('#nv-phone').value||null,status:'Pending'});
  await refresh();closeModal();toast(n+' added to the directory.');go('vendors');
 }catch(e){toast(e.message,'x')}
})()}


/* ========================================================= APPROVAL WORKFLOW */
function sendApprovalModal(rfqId){
 const r=rById(rfqId);const qs=quotesFor(rfqId).slice().sort((a,b)=>a.price-b.price);
 const opts=qs.map((q,i)=>{const v=vById(q.vendorId);return `<option value="${q.id}">${v.name} — ${inr(q.price)}/unit · ${q.days}d ${i===0?'(lowest)':''}</option>`}).join('');
 modal(`<div class="modal-h"><div><h3>Send for Approval</h3><p>${r.code} · ${r.title}</p></div><button class="x-btn" onclick="closeModal()">${ic('x',16)}</button></div>
 <div class="modal-b"><div class="field"><label>Recommended Vendor</label><select id="ap-quote">${opts}</select><div class="hint">Pre-selected to the lowest quote — change if delivery or rating matters more.</div></div>
  <div class="field"><label>Note to Approver (optional)</label><textarea id="ap-note" placeholder="Why this recommendation…"></textarea></div></div>
 <div class="modal-f"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="sendApproval('${rfqId}')">${ic('send',15)} Submit</button></div>`);
}
function sendApproval(rfqId){(async()=>{
 try{await API.post('/api/rfqs/'+rfqId+'/send-approval',{quotationId:$('#ap-quote').value,note:$('#ap-note').value||''});
  await refresh();closeModal();toast('Sent to the approver for decision.','send');go('rfq',String(rfqId));
 }catch(e){toast(e.message,'x')}
})()}
function decideModal(aId){
 const a=DB.approvals.find(x=>x.id===aId);const r=rById(a.rfqId);const q=qById(a.quoteId);const v=vById(q.vendorId);
 const qs=quotesFor(r.id).slice().sort((x,y)=>x.price-y.price);
 modal(`<div class="modal-h"><div><h3>Review Approval</h3><p>${r.code} · ${r.title}</p></div><button class="x-btn" onclick="closeModal()">${ic('x',16)}</button></div>
 <div class="modal-b">
  <div class="card card-pad" style="background:var(--surface-2);margin-bottom:16px"><div class="spread"><div class="cellrow"><span class="av-sq" style="background:${colorFor(v.name)};width:40px;height:40px">${initials(v.name)}</span><div><div class="strong">${v.name}</div><div class="sub">${q.days}-day delivery · ${v.rating}★ rating</div></div></div><div class="rt"><div class="sub">Total value</div><div class="strong mono" style="font-size:18px">${inr(q.price*r.qty)}</div></div></div></div>
  <div class="sub" style="margin-bottom:8px"><b>${qs.length}</b> quotes compared · recommended is the ${qs[0].id===q.id?'<b style="color:var(--teal-d)">lowest priced</b>':'preferred'} option</div>
  <div class="field"><label>Approval Remark</label><textarea id="dec-note" placeholder="Reason for your decision (kept on the audit trail)…">${qs[0].id===q.id?'Best balance of price and delivery — approved.':''}</textarea></div></div>
 <div class="modal-f"><button class="btn btn-danger" onclick="decide('${aId}','Rejected')">${ic('x',15)} Reject</button><button class="btn btn-primary" onclick="decide('${aId}','Approved')">${ic('check',15)} Approve</button></div>`);
}
function decide(aId,decision){(async()=>{
 const remark=$('#dec-note')?$('#dec-note').value:'';
 try{const out=await API.post('/api/approvals/'+aId+'/decide',{decision,remark});
  await refresh();closeModal();
  if(decision==='Approved')toast('Approved — '+out.poCode+' & invoice generated automatically.','check');
  else toast('Rejected and returned for re-sourcing.','x');
  go(S.user.role==='vendor'?'dash':'approvals');
 }catch(e){toast(e.message,'x')}
})()}


/* ========================================================= APPROVALS PAGE */
function vApprovals(){
 const pend=DB.approvals.filter(a=>a.state==='Under Review');
 const done=DB.approvals.filter(a=>a.state!=='Under Review');
 return head('Approvals','Approval Workflow','Review recommended quotations — approve to auto-generate the PO and invoice, or reject to send it back for re-sourcing.')
 +`<div class="card mb16"><div class="card-h"><div class="ttl"><span class="mini-ic" style="background:#F59E0B">${ic('clock',16)}</span><h3>Pending Decisions</h3></div><span class="badge b-review"><span class="dot"></span>${pend.length} waiting</span></div>
   ${pend.length?`<table class="tbl"><thead><tr><th>RFQ</th><th>Recommended Vendor</th><th>Value</th><th>Submitted</th><th></th></tr></thead><tbody>${pend.map(approvalRow).join('')}</tbody></table>`:empty('No approvals pending — you\u2019re all caught up.')}</div>
  <div class="card"><div class="card-h"><div class="ttl"><span class="mini-ic" style="background:#8B5CF6">${ic('activity',16)}</span><h3>Decision History</h3></div></div>
   ${done.length?`<table class="tbl"><thead><tr><th>RFQ</th><th>Vendor</th><th>Value</th><th>Decision</th><th>By</th><th>When</th></tr></thead><tbody>
   ${done.map(a=>{const r=rById(a.rfqId),q=qById(a.quoteId),v=vById(q.vendorId);return `<tr><td><div class="strong">${r.code}</div><div class="sub">${r.title}</div></td><td><div class="cellrow"><span class="av-sq" style="background:${colorFor(v.name)}">${initials(v.name)}</span>${v.name}</div></td><td class="mono strong">${inr(q.price*r.qty)}</td><td>${badge(a.state)}</td><td class="sub">${a.by||'—'}</td><td class="sub">${fmt(a.at)}</td></tr>`}).join('')}
   </tbody></table>`:empty('No decisions recorded yet.')}</div>`;
}


/* ========================================================= VENDOR QUOTE SUBMISSION */
function quoteModal(rfqId){
 const r=rById(rfqId);const vid=S.user.vendorId;const ex=DB.quotes.find(q=>q.rfqId===rfqId&&q.vendorId===vid);
 modal(`<div class="modal-h"><div><h3>${ex?'Edit Quotation':'Submit Quotation'}</h3><p>${r.code} · ${r.title}</p></div><button class="x-btn" onclick="closeModal()">${ic('x',16)}</button></div>
 <div class="modal-b"><div class="card card-pad" style="background:var(--surface-2);margin-bottom:16px;font-size:13px"><b>Requirement:</b> ${r.details}<div class="sub mt16">Quantity: ${r.qty} ${r.unit} · Deadline: ${fmt(r.deadline)}</div></div>
  <div class="row"><div class="field"><label>Unit Price (₹)</label><input id="qt-price" type="number" value="${ex?ex.price:''}" placeholder="0"></div><div class="field"><label>Delivery (days)</label><input id="qt-days" type="number" value="${ex?ex.days:''}" placeholder="0"></div></div>
  <div class="field"><label>Notes to Buyer</label><textarea id="qt-notes" placeholder="Warranty, terms, what makes your offer stand out…">${ex?ex.notes:''}</textarea></div></div>
 <div class="modal-f"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="submitQuote('${rfqId}')">${ic('send',15)} ${ex?'Update':'Submit'} Quotation</button></div>`);
}
function submitQuote(rfqId){(async()=>{
 const price=+$('#qt-price').value,days=+$('#qt-days').value;
 if(!price||!days){toast('Enter a price and a delivery timeline.','x');return}
 try{await API.post('/api/rfqs/'+rfqId+'/quotations',{unitPrice:price,deliveryDays:days,notes:$('#qt-notes').value||''});
  await refresh();closeModal();toast('Quotation submitted successfully.','send');go(S.view);
 }catch(e){toast(e.message,'x')}
})()}
function vQuotes(){
 const vid=S.user.vendorId;const list=DB.rfqs.filter(r=>r.vendors.includes(vid)&&r.status==='Open');
 return head('Vendor portal','Open RFQ Invitations','Requests you\u2019ve been invited to — respond before the deadline to win the business.')
 +`<div class="card">${list.length?`<table class="tbl"><thead><tr><th>RFQ</th><th>Requirement</th><th>Qty</th><th>Deadline</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(r=>{const q=DB.quotes.find(x=>x.rfqId===r.id&&x.vendorId===vid);return `<tr><td class="strong">${r.code}</td><td><div class="strong" style="font-weight:600">${r.title}</div><div class="sub">${r.details}</div></td><td class="sub">${r.qty} ${r.unit}</td><td class="mono">${fmt(r.deadline)}</td><td>${q?badge('Submitted'):badge('Invited')}</td><td class="rt"><button class="btn ${q?'':'btn-primary'} btn-sm" onclick="quoteModal('${r.id}')">${q?'Edit':'Submit Quote'}</button></td></tr>`}).join('')}
  </tbody></table>`:empty('No open invitations right now.')}</div>`;
}
function vMyRFQs(){
 const vid=S.user.vendorId;const my=DB.quotes.filter(q=>q.vendorId===vid);
 return head('Vendor portal','My Quotations','Every quote you\u2019ve submitted and where it stands.')
 +`<div class="card">${my.length?`<table class="tbl"><thead><tr><th>RFQ</th><th>Your Price</th><th>Delivery</th><th>Total</th><th>Outcome</th></tr></thead><tbody>
  ${my.map(q=>{const r=rById(q.rfqId);const won=DB.pos.some(p=>p.quoteId===q.id);const out=won?'Awarded':r.status==='Completed'?'Not selected':r.status==='In Approval'?'Under Review':'Open';return `<tr><td><div class="strong">${r.code}</div><div class="sub">${r.title}</div></td><td class="mono strong">${inr(q.price)}</td><td class="sub">${q.days} days</td><td class="mono">${inr(q.price*r.qty)}</td><td>${badge(won?'Approved':out==='Not selected'?'Rejected':out==='Under Review'?'Under Review':'Open')}</td></tr>`}).join('')}
  </tbody></table>`:empty('You haven\u2019t submitted any quotations yet.')}</div>`;
}
function vMyPOs(){
 const vid=S.user.vendorId;const my=DB.pos.filter(p=>p.vendorId===vid);
 return head('Vendor portal','My Orders','Purchase orders awarded to you, with their invoices.')
 +`<div class="card">${my.length?`<table class="tbl"><thead><tr><th>PO</th><th>RFQ</th><th>Qty</th><th>Value</th><th>Invoice</th><th></th></tr></thead><tbody>
  ${my.map(p=>{const inv=DB.invoices.find(i=>i.poId===p.id);const r=rById(p.rfqId);return `<tr><td class="strong">${p.code}</td><td class="sub">${r.title}</td><td class="sub">${p.qty}</td><td class="mono strong">${inr(p.price*p.qty)}</td><td>${inv?badge(inv.status):'—'}</td><td class="rt"><button class="btn btn-sm" onclick="poDetail('${p.id}')">View</button></td></tr>`}).join('')}
  </tbody></table>`:empty('No awarded orders yet.')}</div>`;
}


/* ========================================================= POs / INVOICES */
function vPOs(){
 const s=S.search.toLowerCase();let list=DB.pos.filter(p=>!s||(p.code+rById(p.rfqId).title+vById(p.vendorId).name).toLowerCase().includes(s));
 return head('Procurement','Purchase Orders','Official orders auto-generated the moment a quotation is approved.')
 +`<div class="card"><div class="card-h"><h3 style="font-family:var(--font-display);font-size:16px">All Purchase Orders</h3><span class="sub">${list.length} orders</span></div>
  ${list.length?`<table class="tbl"><thead><tr><th>PO Number</th><th>Vendor</th><th>RFQ</th><th>Qty</th><th>Value</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(p=>{const v=vById(p.vendorId);const r=rById(p.rfqId);return `<tr><td class="strong">${p.code}</td><td><div class="cellrow"><span class="av-sq" style="background:${colorFor(v.name)}">${initials(v.name)}</span>${v.name}</div></td><td class="sub">${r.title}</td><td class="sub">${p.qty}</td><td class="mono strong">${inr(p.price*p.qty)}</td><td>${badge(p.status)}</td><td class="rt"><button class="btn btn-sm" onclick="poDetail('${p.id}')">View</button></td></tr>`}).join('')}
  </tbody></table>`:empty('No purchase orders yet — approve a quotation to generate one.')}</div>`;
}
function vInvoices(){
 const s=S.search.toLowerCase();let list=DB.invoices.filter(i=>!s||(i.code+vById(i.vendorId).name).toLowerCase().includes(s));
 const totalDue=list.filter(i=>i.status!=='Paid').reduce((a,i)=>a+tax(i).total,0);
 return head('Finance','Invoices','Generated from purchase orders with tax computed — download, print or email in one click.',
  `<span class="badge b-open" style="padding:9px 13px">Outstanding: ${inr(totalDue)}</span>`)
 +`<div class="card"><div class="card-h"><h3 style="font-family:var(--font-display);font-size:16px">All Invoices</h3><span class="sub">${list.length} invoices</span></div>
  ${list.length?`<table class="tbl"><thead><tr><th>Invoice</th><th>Vendor</th><th>Subtotal</th><th>GST</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(i=>{const v=vById(i.vendorId);const t=tax(i);return `<tr><td class="strong">${i.code}</td><td><div class="cellrow"><span class="av-sq" style="background:${colorFor(v.name)}">${initials(v.name)}</span>${v.name}</div></td><td class="mono sub">${inr(i.subtotal)}</td><td class="mono sub">${inr(t.tax)}</td><td class="mono strong">${inr(t.total)}</td><td>${badge(i.status)}</td><td class="rt"><button class="btn btn-sm" onclick="invDetail('${i.id}')">Open</button></td></tr>`}).join('')}
  </tbody></table>`:empty('No invoices yet.')}</div>`;
}
function poDetail(pId){
 const p=DB.pos.find(x=>x.id===pId);const v=vById(p.vendorId);const r=rById(p.rfqId);
 modal(`<div class="modal-h"><div><h3>${p.code}</h3><p>Purchase Order · ${fmt(p.at)}</p></div><button class="x-btn" onclick="closeModal()">${ic('x',16)}</button></div>
 <div class="modal-b"><div class="spread mb16"><div><div class="sub">Vendor</div><b>${v.name}</b><div class="sub">${v.gst}</div></div><div class="rt">${badge(p.status)}</div></div>
  <div class="doc-line"><span>${r.title}</span><span>${p.qty} × ${inr(p.price)}</span></div>
  <div class="doc-line"><span class="sub">Reference RFQ</span><span class="sub">${r.code}</span></div>
  <div class="doc-tot"><span>Order Value</span><span class="mono">${inr(p.price*p.qty)}</span></div></div>
 <div class="modal-f"><button class="btn" onclick="printDoc('po','${pId}')">${ic('print',15)} Print</button><button class="btn btn-primary" onclick="downloadPDF('po','${pId}')">${ic('download',15)} Download PDF</button></div>`);
}
function invDetail(iId){
 const i=DB.invoices.find(x=>x.id===iId);const v=vById(i.vendorId);const t=tax(i);const po=DB.pos.find(p=>p.id===i.poId);
 const isVendor=S.user.role==='vendor';
 modal(`<div class="modal-h"><div><h3>${i.code}</h3><p>Tax Invoice · ${fmt(i.at)}</p></div><button class="x-btn" onclick="closeModal()">${ic('x',16)}</button></div>
 <div class="modal-b"><div class="spread mb16"><div><div class="sub">Billed to / from</div><b>${v.name}</b><div class="sub">${v.gst}</div></div><div class="rt">${badge(i.status)}</div></div>
  <div class="doc-line"><span>Subtotal${po?' ('+po.qty+' × '+inr(po.price)+')':''}</span><span class="mono">${inr(i.subtotal)}</span></div>
  <div class="doc-line"><span>GST @ ${i.taxRate}%</span><span class="mono">${inr(t.tax)}</span></div>
  <div class="doc-tot"><span>Total Payable</span><span class="mono">${inr(t.total)}</span></div></div>
 <div class="modal-f">${isVendor?'':`<button class="btn" onclick="emailInvoice('${iId}')">${ic('mail',15)} Email</button>`}<button class="btn" onclick="printDoc('inv','${iId}')">${ic('print',15)} Print</button><button class="btn btn-primary" onclick="downloadPDF('inv','${iId}')">${ic('download',15)} Download PDF</button>${(!isVendor&&i.status!=='Paid')?`<button class="btn btn-dark" onclick="markPaid('${iId}')">${ic('check',15)} Mark Paid</button>`:''}</div>`);
}
function emailInvoice(iId){(async()=>{try{await API.post('/api/orders/invoices/'+iId+'/email',{});await refresh();closeModal();toast('Invoice emailed to the vendor.','mail');go(S.view);}catch(e){toast(e.message,'x')}})()}
function markPaid(iId){(async()=>{try{await API.post('/api/orders/invoices/'+iId+'/pay',{});await refresh();closeModal();toast('Invoice marked as paid.','check');go(S.view);}catch(e){toast(e.message,'x')}})()}

/* ----- printing & PDF ----- */
function docHTML(type,id){
 if(type==='inv'){const i=DB.invoices.find(x=>x.id===id);const v=vById(i.vendorId);const t=tax(i);const po=DB.pos.find(p=>p.id===i.poId);
  return docShell(i.code,'TAX INVOICE',v,[['Subtotal'+(po?' ('+po.qty+' × '+inr(po.price)+')':''),inr(i.subtotal)],['GST @ '+i.taxRate+'%',inr(t.tax)]],['Total Payable',inr(t.total)],fmt(i.at),i.status)}
 const p=DB.pos.find(x=>x.id===id);const v=vById(p.vendorId);const r=rById(p.rfqId);
 return docShell(p.code,'PURCHASE ORDER',v,[[r.title,p.qty+' × '+inr(p.price)],['Reference RFQ',r.code]],['Order Value',inr(p.price*p.qty)],fmt(p.at),p.status);
}
function docShell(code,kind,v,lines,total,date,status){
 return `<div style="font-family:Hanken Grotesk,Arial,sans-serif;color:#16263B;max-width:700px;margin:0 auto">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0D9488;padding-bottom:18px;margin-bottom:24px">
   <div><div style="font-family:Fraunces,Georgia,serif;font-size:26px;font-weight:700">VendorBridge</div><div style="color:#647A93;font-size:12px">Procurement &amp; Vendor Management ERP</div></div>
   <div style="text-align:right"><div style="font-size:13px;letter-spacing:2px;color:#0D9488;font-weight:700">${kind}</div><div style="font-size:20px;font-weight:700">${code}</div><div style="color:#647A93;font-size:12px">${date}</div></div></div>
  <div style="display:flex;justify-content:space-between;margin-bottom:22px"><div><div style="font-size:11px;color:#9AACC0;letter-spacing:1px">VENDOR</div><div style="font-weight:700;font-size:15px">${v.name}</div><div style="color:#647A93;font-size:12px">${v.gst}<br>${v.email} · ${v.phone}</div></div><div style="text-align:right"><div style="font-size:11px;color:#9AACC0;letter-spacing:1px">STATUS</div><div style="font-weight:700">${status}</div></div></div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px">${lines.map(l=>`<tr><td style="padding:11px 0;border-bottom:1px solid #EEF2F7;font-size:14px">${l[0]}</td><td style="padding:11px 0;border-bottom:1px solid #EEF2F7;text-align:right;font-size:14px">${l[1]}</td></tr>`).join('')}</table>
  <div style="display:flex;justify-content:space-between;padding:16px 0;font-family:Fraunces,Georgia,serif;font-size:22px;font-weight:700"><span>${total[0]}</span><span>${total[1]}</span></div>
  <div style="margin-top:36px;color:#9AACC0;font-size:11px;border-top:1px solid #EEF2F7;padding-top:14px">Generated by VendorBridge · This is a system-generated document and is valid without signature.</div></div>`;
}
function printDoc(type,id){const pa=$('#print-area');pa.innerHTML=docHTML(type,id);pa.style.display='block';window.print();setTimeout(()=>{pa.style.display='none'},400)}
function downloadPDF(type,id){
 if(!window.jspdf){printDoc(type,id);return}
 const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'pt',format:'a4'});
 let o;if(type==='inv'){const i=DB.invoices.find(x=>x.id===id);const v=vById(i.vendorId);const t=tax(i);const po=DB.pos.find(p=>p.id===i.poId);o={code:i.code,kind:'TAX INVOICE',v,date:fmt(i.at),status:i.status,lines:[['Subtotal'+(po?' ('+po.qty+' x '+inr(po.price)+')':''),inr(i.subtotal)],['GST @ '+i.taxRate+'%',inr(t.tax)]],total:['Total Payable',inr(t.total)]}}
 else{const p=DB.pos.find(x=>x.id===id);const v=vById(p.vendorId);const r=rById(p.rfqId);o={code:p.code,kind:'PURCHASE ORDER',v,date:fmt(p.at),status:p.status,lines:[[r.title,p.qty+' x '+inr(p.price)],['Reference RFQ',r.code]],total:['Order Value',inr(p.price*p.qty)]}}
 doc.setFont('helvetica','bold');doc.setFontSize(22);doc.text('VendorBridge',40,54);
 doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(120);doc.text('Procurement & Vendor Management ERP',40,70);
 doc.setTextColor(13,148,136);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text(o.kind,555,50,{align:'right'});
 doc.setTextColor(20);doc.setFontSize(16);doc.text(o.code,555,70,{align:'right'});
 doc.setDrawColor(13,148,136);doc.setLineWidth(2);doc.line(40,84,555,84);
 doc.setTextColor(20);doc.setFontSize(12);doc.text(o.v.name,40,118);
 doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(120);doc.text(o.v.gst,40,132);doc.text(o.date+'  ·  '+o.status,555,118,{align:'right'});
 let y=170;doc.setFontSize(11);
 o.lines.forEach(l=>{doc.setTextColor(40);doc.setFont('helvetica','normal');doc.text(l[0],40,y);doc.text(l[1],555,y,{align:'right'});doc.setDrawColor(235);doc.setLineWidth(.5);doc.line(40,y+8,555,y+8);y+=30});
 y+=10;doc.setFont('helvetica','bold');doc.setFontSize(15);doc.text(o.total[0],40,y);doc.text(o.total[1],555,y,{align:'right'});
 doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(150);doc.text('Generated by VendorBridge · valid without signature.',40,800);
 doc.save(o.code+'.pdf');toast(`${o.code}.pdf downloaded.`,'download');
}


/* ========================================================= ACTIVITY / REPORTS / USERS */
function activityList(n){const items=DB.activity.slice(0,n);const ico={rfq:['rfq','#3B82F6'],quote:['quote','#8B5CF6'],approve:['approve','#14B8A6'],po:['po','#0EA5E9'],invoice:['invoice','#F59E0B'],vendors:['vendors','#EC4899']};
 return `<div class="tl">${items.map(a=>{const[icn,c]=ico[a.type]||['activity','#647A93'];return `<div class="tl-i done"><span class="nd" style="border-color:${c};background:${c}"></span><div class="tx">${a.text}</div><div class="mt">${a.actor} · ${ago(a.at)}</div></div>`}).join('')}</div>`}
function vActivity(){return head('Transparency','Activity & Audit Log','Every meaningful action — who did it, and when. Nothing happens off the record.')
 +`<div class="card card-pad">${activityList(40)}</div>`}
function vReports(){
 const {trend,lab}=monthlySpend();
 const byV={};DB.invoices.forEach(i=>{const v=vById(i.vendorId);byV[v.name]=(byV[v.name]||0)+tax(i).total});
 const perf=DB.vendors.map(v=>{const won=DB.pos.filter(p=>p.vendorId===v.id).length;const quoted=DB.quotes.filter(q=>q.vendorId===v.id).length;return{v,won,quoted,rate:quoted?Math.round(won/quoted*100):0}}).sort((a,b)=>b.won-a.won);
 return head('Insights','Reports & Analytics','Spend trends, vendor performance and procurement statistics — exportable any time.',
  `<button class="btn" onclick="toast('Report exported to CSV.','download')">${ic('download',15)} Export</button>`)
 +`<div class="grid g4 stagger mb16">
   ${statCard('trend','#14B8A6',inr(spend()),'Total Spend')}
   ${statCard('po','#3B82F6',DB.pos.length,'Purchase Orders')}
   ${statCard('rfq','#8B5CF6',DB.rfqs.length,'RFQs Raised')}
   ${statCard('vendors','#F59E0B',DB.vendors.filter(v=>v.status==='Active').length,'Active Vendors')}
  </div>
  <div class="grid g2 mb16">
   <div class="card card-pad"><h3 style="font-family:var(--font-display);font-size:16px;margin-bottom:14px">Monthly Procurement Spend</h3>${chartArea(trend,lab)}</div>
   <div class="card card-pad"><h3 style="font-family:var(--font-display);font-size:16px;margin-bottom:14px">RFQ Pipeline</h3>${chartDonut(rfqStatusSegs())}</div>
  </div>
  <div class="grid g2">
   <div class="card card-pad"><h3 style="font-family:var(--font-display);font-size:16px;margin-bottom:14px">Spend by Vendor</h3>${chartBars(Object.entries(byV).map(([l,v],i)=>({label:l.split(' ')[0],value:v,color:PAL[i%PAL.length],short:inr(v)})))}</div>
   <div class="card"><div class="card-h"><h3 style="font-family:var(--font-display);font-size:16px">Vendor Performance</h3></div>
    <table class="tbl"><thead><tr><th>Vendor</th><th>Quoted</th><th>Won</th><th>Win Rate</th><th>Rating</th></tr></thead><tbody>
    ${perf.map(p=>`<tr><td><div class="cellrow"><span class="av-sq" style="background:${colorFor(p.v.name)}">${initials(p.v.name)}</span>${p.v.name}</div></td><td class="sub">${p.quoted}</td><td class="strong">${p.won}</td><td><b>${p.rate}%</b></td><td>${p.v.rating}★</td></tr>`).join('')}
    </tbody></table></div>
  </div>`;
}
function vUsers(){
 const rl={officer:'Procurement Officer',manager:'Manager / Approver',admin:'Administrator'};
 const rc={officer:'#14B8A6',manager:'#8B5CF6',admin:'#F59E0B'};
 return head('Administration','User Management','Create and manage the internal users who run procurement. Vendors self-register and appear below.',
  `<button class="btn btn-primary" onclick="userModal()">${ic('plus',15)} Add User</button>`)
 +`<div class="card"><div class="card-h"><h3 style="font-family:var(--font-display);font-size:16px">Internal Users</h3><span class="sub">${DB.users.length} user${DB.users.length!==1?'s':''}</span></div>
  ${DB.users.length?`<table class="tbl"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>
  ${DB.users.map(u=>`<tr><td><div class="cellrow"><span class="av-sq" style="background:${rc[u.role]||colorFor(u.name)}">${initials(u.name)}</span><div class="strong">${u.name}</div></div></td><td class="sub">${u.email}</td><td>${rl[u.role]||u.role}</td><td>${badge('Active')}</td></tr>`).join('')}
  </tbody></table>`:empty('No internal users yet — add your procurement team.')}</div>
  <div class="card mt16"><div class="card-h"><h3 style="font-family:var(--font-display);font-size:16px">Vendor Accounts</h3><span class="sub">${DB.vendors.length} vendor${DB.vendors.length!==1?'s':''}</span></div>
  ${DB.vendors.length?`<table class="tbl"><thead><tr><th>Vendor</th><th>Category</th><th>Email</th><th>Status</th></tr></thead><tbody>
  ${DB.vendors.map(v=>`<tr><td><div class="cellrow"><span class="av-sq" style="background:${colorFor(v.name)}">${initials(v.name)}</span>${v.name}</div></td><td class="sub">${v.cat}</td><td class="sub">${v.email||'—'}</td><td>${badge(v.status)}</td></tr>`).join('')}
  </tbody></table>`:empty('No vendors have registered yet.')}</div>`;
}
function userModal(){
 modal(`<div class="modal-h"><div><h3>Add Internal User</h3><p>Create a procurement officer, manager or administrator.</p></div><button class="x-btn" onclick="closeModal()">${ic('x',16)}</button></div>
 <div class="modal-b"><div class="field"><label>Full Name</label><input id="nu-name" placeholder="Jane Doe"></div>
  <div class="field"><label>Email</label><input id="nu-email" type="email" placeholder="jane@company.com"></div>
  <div class="row"><div class="field"><label>Temporary Password</label><input id="nu-pass" type="password" placeholder="min. 8 characters"></div>
   <div class="field"><label>Role</label><select id="nu-role"><option value="officer">Procurement Officer</option><option value="manager">Manager / Approver</option><option value="admin">Administrator</option></select></div></div></div>
 <div class="modal-f"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="createUser()">Create User</button></div>`);
}
function createUser(){(async()=>{
 const name=$('#nu-name').value.trim(),email=$('#nu-email').value.trim(),password=$('#nu-pass').value,role=$('#nu-role').value;
 if(!name||!email||(password||'').length<8){toast('Name, a valid email and an 8+ character password are required.','x');return}
 try{await API.post('/api/users',{name,email,password,role});await refresh();closeModal();toast(name+' added to the team.','check');go('users');}
 catch(e){toast(e.message,'x')}
})()}


/* ========================================================= NOTIFICATIONS / SEARCH */
function updateNotif(){const el=$('#notif-ct');if(!el||!S.user)return;const u=DB.activity.filter(a=>a.at>(S.readAt||0)).length;el.textContent=Math.min(u,9);el.style.display=u?'grid':'none'}
function toggleNotif(e){e.stopPropagation();const dd=$('#dd');if(dd.style.display==='block'){dd.style.display='none';return}
 const ico={rfq:['rfq','#3B82F6'],quote:['quote','#8B5CF6'],approve:['approve','#14B8A6'],po:['po','#0EA5E9'],invoice:['invoice','#F59E0B'],vendors:['vendors','#EC4899']};
 dd.innerHTML=`<div class="dd-h">Notifications <a class="linkish" style="font-size:12px;cursor:pointer" onclick="$('#dd').style.display='none'">Mark all read</a></div>${DB.activity.slice(0,6).map(a=>{const[icn,c]=ico[a.type]||['activity','#647A93'];return `<div class="dd-i"><span class="dd-dot" style="background:${c}">${ic(icn,14)}</span><div><div class="tx">${a.text}</div><div class="mt">${ago(a.at)}</div></div></div>`}).join('')}`;
 dd.style.display='block';S.readAt=Date.now();updateNotif();
}
document.addEventListener('click',e=>{const dd=$('#dd');if(dd.style.display==='block'&&!dd.contains(e.target))dd.style.display='none'});
function onSearch(v){S.search=v;if(['rfqs','vendors','pos','invoices'].includes(S.view))go(S.view)}


/* ========================================================= INIT */
$('#lg-email').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
$('#lg-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
(async()=>{const t=API.getToken();if(!t)return;try{const me=await API.get('/api/auth/me');await afterLogin(me);}catch(e){API.clearToken();}})();

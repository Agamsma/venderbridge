// api.js — token storage + fetch wrapper for the VendorBridge REST API
const API=(()=>{
  const KEY='vb_token';
  const getToken=()=>localStorage.getItem(KEY);
  const setToken=(t)=>localStorage.setItem(KEY,t);
  const clearToken=()=>localStorage.removeItem(KEY);
  async function request(method,path,body){
    const headers={'Content-Type':'application/json'};
    const t=getToken(); if(t) headers.Authorization='Bearer '+t;
    const res=await fetch(path,{method,headers,body:body!==undefined?JSON.stringify(body):undefined});
    let data=null; try{ data=await res.json(); }catch(e){}
    if(!res.ok) throw new Error((data&&data.error)||('Request failed ('+res.status+')'));
    return data;
  }
  return {
    getToken,setToken,clearToken,
    get:(p)=>request('GET',p),
    post:(p,b)=>request('POST',p,b),
    patch:(p,b)=>request('PATCH',p,b),
    async login(email,password){const d=await request('POST','/api/auth/login',{email,password});setToken(d.token);return d;},
    async register(payload){const d=await request('POST','/api/auth/register',payload);setToken(d.token);return d;},
  };
})();
window.API=API;

import json, sys, re
import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tr1, tr2, tr3
T = {**tr1.T, **tr2.T, **tr3.T}; F = tr2.F
norm = lambda s: re.sub(r'\s+', ' ', s).strip()
exact = {}; pats = []
for k, v in T.items():
    k2 = norm(k)
    if re.search(r'\{\d\}', k2): pats.append([k2, v])
    else: exact[k2] = v
frags = {norm(k): v for k, v in F.items()}
for k, v in exact.items(): frags.setdefault(k, v)
fr = sorted(frags.items(), key=lambda x: -len(x[0]))
data = {'e': exact, 'p': sorted(pats, key=lambda x: -len(x[0])), 'f': fr}
engine = r'''
/* ===== i18n: русский / английский. Словарь собран из всех строк интерфейса; экран переводится на лету ===== */
(function(){
var D=__DATA__;
var CYR=/[А-Яа-яЁё]/,isL=function(c){return !!c&&/[A-Za-zА-Яа-яЁё0-9]/.test(c)};
function detect(){try{var s=localStorage.getItem('lang');if(s==='ru'||s==='en')return s}catch(e){}
 try{var u=window.Telegram&&Telegram.WebApp&&Telegram.WebApp.initDataUnsafe&&Telegram.WebApp.initDataUnsafe.user;var lc=((u&&u.language_code)||navigator.language||'ru').toLowerCase().slice(0,2);return ['ru','uk','be','kk','uz','ky','tg','az','hy','ka'].indexOf(lc)>=0?'ru':'en'}catch(e){return 'ru'}}
window.LANG=detect();
var P=D.p.map(function(x){var src='^'+x[0].replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{(\d)\}/g,'([\\s\\S]*?)')+'$';
  var ord=[];x[0].replace(/\{(\d)\}/g,function(m,d){ord.push(+d)});return [new RegExp(src),x[1],ord]});
var cache={};
function tr(s){if(window.LANG!=='en'||s==null)return s;s=String(s);if(!CYR.test(s))return s;
 if(cache.hasOwnProperty(s))return cache[s];
 var m=s.match(/^(\s*)([\s\S]*?)(\s*)$/),pre=m[1],body=m[2].replace(/\s+/g,' '),post=m[3],out=null;
 if(D.e.hasOwnProperty(body))out=D.e[body];
 if(out==null)for(var i=0;i<P.length;i++){var r=body.match(P[i][0]);if(r){var vals={};for(var j=0;j<P[i][2].length;j++)vals[P[i][2][j]]=tr(r[j+1]);out=P[i][1].replace(/\{(\d)\}/g,function(_,d){return vals[d]!=null?vals[d]:''});break}}
 if(out==null){out=body;for(var k=0;k<D.f.length&&CYR.test(out);k++){var ru=D.f[k][0],en=D.f[k][1],at=0,res='',idx;
   while((idx=out.indexOf(ru,at))>=0){var a=out.charAt(idx-1),b=out.charAt(idx+ru.length),ok=!(CYR.test(ru.charAt(0))&&isL(a))&&!(CYR.test(ru.charAt(ru.length-1))&&isL(b));
     res+=out.slice(at,idx)+(ok?en:ru);at=idx+ru.length}
   out=res+out.slice(at)}}
 out=pre+out+post;cache[s]=out;return out}
window.tr=tr;
var ATTRS=['placeholder','title','aria-label'];
function trNode(n){if(window.LANG!=='en')return;
 if(n.nodeType===3){var pn=n.parentNode;if(pn&&/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(pn.tagName))return;if(CYR.test(n.data)){var t=tr(n.data);if(t!==n.data)n.data=t}return}
 if(n.nodeType!==1||n.tagName==='SCRIPT'||n.tagName==='STYLE')return;
 for(var i=0;i<ATTRS.length;i++){var v=n.getAttribute&&n.getAttribute(ATTRS[i]);if(v&&CYR.test(v))n.setAttribute(ATTRS[i],tr(v))}
 if((n.tagName==='INPUT'&&(n.type==='button'||n.type==='submit'))&&CYR.test(n.value))n.value=tr(n.value);
 var w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,null),x;
 while((x=w.nextNode())){if(x.nodeType===3){if(CYR.test(x.data)&&!(x.parentNode&&/^(SCRIPT|STYLE|TEXTAREA)$/.test(x.parentNode.tagName))){var y=tr(x.data);if(y!==x.data)x.data=y}}
  else for(var q=0;q<ATTRS.length;q++){var vv=x.getAttribute(ATTRS[q]);if(vv&&CYR.test(vv))x.setAttribute(ATTRS[q],tr(vv))}}}
window.trNode=trNode;
function start(){trNode(document.body);if(document.title&&CYR.test(document.title))document.title=tr(document.title);
 new MutationObserver(function(ms){if(window.LANG!=='en')return;for(var i=0;i<ms.length;i++){var m=ms[i];
  if(m.type==='characterData')trNode(m.target);else if(m.type==='attributes')trNode(m.target);else for(var j=0;j<m.addedNodes.length;j++)trNode(m.addedNodes[j])}})
 .observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
var oc=window.confirm,op=window.prompt,oa=window.alert;
window.confirm=function(m){return oc.call(window,tr(m))};window.prompt=function(m,d){return op.call(window,tr(m),d)};window.alert=function(m){return oa.call(window,tr(m))};
try{var W=window.Telegram&&Telegram.WebApp;if(W){['showAlert','showConfirm'].forEach(function(f){var o=W[f];if(o)W[f]=function(m,cb){return o.call(W,tr(m),cb)}});
 var sp=W.showPopup;if(sp)W.showPopup=function(p,cb){try{p=Object.assign({},p,{title:tr(p.title),message:tr(p.message),buttons:(p.buttons||[]).map(function(b){return Object.assign({},b,{text:tr(b.text)})})})}catch(e){}return sp.call(W,p,cb)}}}catch(e){}
document.documentElement.lang=window.LANG;
window.setLang=function(l){if(l!=='en'&&l!=='ru')return;try{localStorage.setItem('lang',l)}catch(e){}if(l===window.LANG)return;window.LANG=l;document.documentElement.lang=l;
 try{if(window.TG_LANG_SYNC)TG_LANG_SYNC(l)}catch(e){} location.reload()};
})();
'''
open(sys.argv[1], 'w').write(engine.replace('__DATA__', json.dumps(data, ensure_ascii=False)))
print(len(exact), len(pats), len(fr))

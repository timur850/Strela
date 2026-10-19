/* STRELA CASE — общий каталог подарков и логика игр.
   Этот файл используют И мини-апп (site/index.html), И сервер (worker.js),
   поэтому шансы и цены везде одинаковые. Результат игры всегда решает сервер. */
(function (G) {
const REG_LIST=[["r_heart", "Сердце", 15, "5170145012310081615", "💝"], ["r_bear", "Мишка", 15, "5170233102089322756", "🧸"], ["r_box", "Подарок", 25, "5170250947678437525", "🎁"], ["r_rose", "Роза", 25, "5168103777563050263", "🌹"], ["r_cake", "Торт", 50, "5170144170496491616", "🎂"], ["r_bouquet", "Букет", 50, "5170314324215857265", "💐"], ["r_rocket", "Ракета", 50, "5170564780938756245", "🚀"], ["r_champagne", "Шампанское", 50, "6028601630662853006", "🍾"], ["r_trophy", "Кубок", 100, "5168043875654172773", "🏆"], ["r_ring", "Кольцо", 100, "5170690322832818290", "💍"], ["r_gem", "Алмаз", 100, "5170521118301225164", "💎"]];
const NFT_LIST=[["plushpepe", "Plush Pepe", 999900], ["heartlocket", "Heart Locket", 206850], ["durovscap", "Durov's Cap", 67500], ["preciouspeach", "Precious Peach", 44850], ["scaredcat", "Scared Cat", 42750], ["heroichelmet", "Heroic Helmet", 36000], ["astralshard", "Astral Shard", 22350], ["lootbag", "Loot Bag", 21750], ["mightyarm", "Mighty Arm", 19500], ["nailbracelet", "Nail Bracelet", 18150], ["durovsglasses", "Durov's Glasses", 17850], ["westsidesign", "Westside Sign", 16800], ["minioscar", "Mini Oscar", 11700], ["iongem", "Ion Gem", 11100], ["perfumebottle", "Perfume Bottle", 10950], ["artisanbrick", "Artisan Brick", 10500], ["gemsignet", "Gem Signet", 10200], ["magicpotion", "Magic Potion", 9750], ["lowrider", "Low Rider", 9450], ["swisswatch", "Swiss Watch", 8400], ["kissedfrog", "Kissed Frog", 7500], ["sharptongue", "Sharp Tongue", 7350], ["bondedring", "Bonded Ring", 7050], ["vintagecigar", "Vintage Cigar", 6150], ["voodoodoll", "Voodoo Doll", 5850], ["signetring", "Signet Ring", 5700], ["nekohelmet", "Neko Helmet", 5700], ["genielamp", "Genie Lamp", 5400], ["toybear", "Toy Bear", 5250], ["diamondring", "Diamond Ring", 4950], ["blingbinky", "Bling Binky", 4500], ["rarebird", "Rare Bird", 4500], ["khabibspapakha", "Khabib's Papakha", 4350], ["electricskull", "Electric Skull", 4350], ["eternalrose", "Eternal Rose", 4200], ["cupidcharm", "Cupid Charm", 3450], ["skystilettos", "Sky Stilettos", 2850], ["trappedheart", "Trapped Heart", 2700], ["ufcstrike", "UFC Strike", 2550], ["ionicdryer", "Ionic Dryer", 2400], ["snoopcigar", "Snoop Cigar", 2400], ["lovepotion", "Love Potion", 2250], ["crystalball", "Crystal Ball", 2100], ["madpumpkin", "Mad Pumpkin", 2100], ["flyingbroom", "Flying Broom", 1950], ["recordplayer", "Record Player", 1950], ["skullflower", "Skull Flower", 1950], ["valentinebox", "Valentine Box", 1800], ["lovecandle", "Love Candle", 1650], ["tophat", "Top Hat", 1650], ["sakuraflower", "Sakura Flower", 1650], ["hangingstar", "Hanging Star", 1500], ["jinglebells", "Jingle Bells", 1500], ["berrybox", "Berry Box", 1350], ["bunnymuffin", "Bunny Muffin", 1350], ["evileye", "Evil Eye", 1350], ["jellybunny", "Jelly Bunny", 1350], ["surgeboard", "Surge Board", 1200], ["joyfulbundle", "Joyful Bundle", 1200], ["sleighbell", "Sleigh Bell", 1200], ["jollychimp", "Jolly Chimp", 1200], ["inputkey", "Input Key", 1050], ["moonpendant", "Moon Pendant", 1050], ["witchhat", "Witch Hat", 1050], ["lushbouquet", "Lush Bouquet", 1050], ["lightsword", "Light Sword", 1050], ["prettyposy", "Pretty Posy", 900], ["snowglobe", "Snow Globe", 900], ["eternalcandle", "Eternal Candle", 900], ["spyagaric", "Spy Agaric", 900], ["bowtie", "Bow Tie", 900], ["snowmittens", "Snow Mittens", 900], ["springbasket", "Spring Basket", 900], ["stellarrocket", "Stellar Rocket", 900], ["santahat", "Santa Hat", 900], ["restlessjar", "Restless Jar", 900], ["moneypot", "Money Pot", 900], ["moussecake", "Mousse Cake", 900], ["swagbag", "Swag Bag", 900], ["faithamulet", "Faith Amulet", 900], ["deskcalendar", "Desk Calendar", 900], ["homemadecake", "Homemade Cake", 900], ["partysparkler", "Party Sparkler", 900], ["snoopdogg", "Snoop Dogg", 900], ["cloverpin", "Clover Pin", 900], ["moodpack", "Mood Pack", 750], ["timelessbook", "Timeless Book", 750], ["libertyfigure", "Liberty Figure", 750], ["lunarsnake", "Lunar Snake", 750], ["jackinthebox", "Jack-in-the-Box", 750], ["starnotepad", "Star Notepad", 750], ["poolfloat", "Pool Float", 750], ["victorymedal", "Victory Medal", 750], ["cookieheart", "Cookie Heart", 750], ["hypnolollipop", "Hypno Lollipop", 750], ["gingercookie", "Ginger Cookie", 750], ["spicedwine", "Spiced Wine", 750], ["hexpot", "Hex Pot", 750], ["winterwreath", "Winter Wreath", 750], ["easteregg", "Easter Egg", 750], ["tamagadget", "Tama Gadget", 750], ["petsnake", "Pet Snake", 750], ["bigyear", "Big Year", 750], ["snakebox", "Snake Box", 750], ["holidaydrink", "Holiday Drink", 750], ["freshsocks", "Fresh Socks", 750], ["vicecream", "Vice Cream", 750], ["bdaycandle", "B-Day Candle", 750], ["lolpop", "Lol Pop", 750], ["jesterhat", "Jester Hat", 750], ["xmasstocking", "Xmas Stocking", 750], ["whipcupcake", "Whip Cupcake", 750], ["instantramen", "Instant Ramen", 750], ["happybrownie", "Happy Brownie", 750], ["icecream", "Ice Cream", 750], ["chillflame", "Chill Flame", 600], ["candycane", "Candy Cane", 600]];
const GIFT_LIST=[
 ...REG_LIST.map(([s,n,p,id,e])=>[s,n,p,e,id]),
 ...NFT_LIST,
 ...[300,200,150,100,75,50,25,15,10,5].map(v=>['stars'+v,v+' звёзд',v,'⭐']),
];
const CASE_DEF=[["Farm", 38, null, 0, ["r_heart", "r_bear", "r_box", "r_rose", "r_cake", "r_gem", "lolpop"], "#7b3dff", "", "FARM"], ["Winter", 975, null, 0, ["candycane", "xmasstocking", "gingercookie", "spicedwine", "santahat", "jinglebells", "winterwreath", "snowmittens", "snowglobe", "sleighbell"], "#3fa7ff", "", ""], ["Halloween", 1050, null, 1, ["witchhat", "hexpot", "spyagaric", "skullflower", "crystalball", "flyingbroom", "madpumpkin", "voodoodoll"], "#ff6a1a", "lim", ""], ["Love", 1200, null, 0, ["r_rose", "cookieheart", "valentinebox", "lovecandle", "cupidcharm", "lovepotion", "trappedheart", "eternalrose", "bondedring", "heartlocket"], "#ff3d8b", "", ""], ["Space", 1350, null, 0, ["stellarrocket", "starnotepad", "moonpendant", "hangingstar", "crystalball", "iongem", "astralshard"], "#4d6bff", "new", ""], ["Westside", 1500, null, 0, ["snoopdogg", "swagbag", "snoopcigar", "lowrider", "westsidesign"], "#22c55e", "", ""], ["Gold Rush", 2850, null, 0, ["moneypot", "diamondring", "signetring", "swisswatch", "bondedring", "gemsignet", "nailbracelet"], "#f2b31a", "new", ""], ["Champions", 3750, null, 0, ["victorymedal", "ufcstrike", "khabibspapakha", "mightyarm", "heroichelmet"], "#e0304a", "", ""], ["Durov", 7350, null, 0, ["toybear", "vintagecigar", "signetring", "swisswatch", "lootbag", "minioscar", "durovsglasses", "durovscap"], "#2e9cf2", "", ""], ["Legend", 11250, null, 0, ["nekohelmet", "kissedfrog", "scaredcat", "iongem", "astralshard", "preciouspeach", "durovscap", "heartlocket", "plushpepe"], "#9a4dff", "", ""]];
const FREE_DEF=[["Free 24h", 0, null, 0, [["stars5",380],["stars10",250],["stars15",150],["stars25",100],["stars50",60],["stars75",25],["stars100",20],["hangingstar",1],["jellybunny",1.5],["jollychimp",1.5],["lightsword",2],["moonpendant",2],["prettyposy",2],["hexpot",2],["cookieheart",2]], "#f2a20f", "", "FREE<em>24</em>"], ["Free", 0, null, 0, [["stars5",350],["stars10",250],["stars15",150],["stars25",120],["stars50",70],["stars100",40],["vintagecigar",.6],["bondedring",.5],["sharptongue",.5],["kissedfrog",.4],["heroichelmet",.08],["scaredcat",.06],["preciouspeach",.05]], "#16a88a", "", "FREE<em>🎫</em>"], ["Friends", 0, null, 0, ["r_cake", "r_rocket", "r_trophy", "r_ring", "r_gem", "lolpop", "instantramen", "deskcalendar"], "#ff3d8b", "new", "FRIENDS<em>×5</em>", 200]];
const EGGS=[['jellybunny','3 кокоса',249],['ionicdryer','3 кокоса',249],['crystalball','4 кокоса',349],['preciouspeach','5 кокосов',999],['heartlocket','5 кокосов',999],['plushpepe','5 кокосов',2999]];
const PM0=[[5.6,2.1,1.1,1,.5,1,1.1,2.1,5.6],[13,3,1.3,.7,.4,.7,1.3,3,13],[29,4,1.5,.3,.2,.3,1.5,4,29]];
const BIN=[1,8,28,56,70,56,28,8,1].map(x=>x/256);   // шансы лунок plinko (8 рядов)
const SLOT_SYMS=['🍉','🥥','🐚','🌺','🍹','💎'];
const DEF_RTP={cases:90,eggs:90,crash:95,mines:95,plinko:95,slots:90,upgrade:90,dig:90}; // как в админке по умолчанию
const PVP_BETS=[100,500,2500], SLOT_BET=100, CRASH_K=.12;
/* задания по умолчанию (пока админ не сохранил свои) */
const DEF_TASKS=[
 {id:'t1',e:'🏖️',t:'Добавить на рабочий стол',type:'home',url:'',r:1,on:1},
 {id:'t2',e:'🔗',t:'Ссылка в био',type:'bio',url:'t.me/StrelaCase_bot',r:1,on:1},
 {id:'t3',e:'📸',t:'Опубликовать историю',type:'story',url:'',r:1,on:1},
 {id:'t4',e:'📢',t:'Подпишитесь на наш канал',type:'channel',url:'https://t.me/',r:1,on:1},
 {id:'t5',e:'▶️',t:'Подпишитесь на YouTube',type:'link',url:'https://youtube.com/',r:1,on:1},
 {id:'t6',e:'💬',t:'Вступите в наш чат',type:'chat',url:'https://t.me/',r:1,on:1},
 {id:'t7',e:'🌴',t:'Подпишитесь в Instagram',type:'link',url:'https://instagram.com/',r:1,on:1}];
const isStar=g=>!!g&&g.slug.startsWith('stars');

function makeLogic(getADM,rand){
 rand=rand||Math.random;
 const A=()=>getADM()||{};
 const R=g=>((A().rtp||{})[g]??DEF_RTP[g]??90)/100;
 const mkG=([slug,name,p,e,tgid])=>({slug,name,price:(A().prices||{})[slug]??p,e,tgid,reg:!!tgid});
 let _GC=null,_GK='';
 const GIFTS=()=>{const a=A();const k=JSON.stringify([a.prices,a.giftOff]);if(k!==_GK||!_GC){_GK=k;_GC=GIFT_LIST.filter(g=>!(a.giftOff||{})[g[0]]).map(mkG)}return _GC};
 const _GALL={};GIFT_LIST.forEach(g=>_GALL[g[0]]=g);
 const giftBy=s=>GIFTS().find(g=>g.slug===s)||(_GALL[s]?mkG(_GALL[s]):null);

 /* выбор подарка так, чтобы средний выигрыш = цена × RTP */
 function pickGift(cost,rtp){
  const pool=GIFTS().filter(g=>(isStar(g)?g.price<cost:g.price>=cost*.15)&&g.price<=cost*40);const P=pool.length?pool:GIFTS();
  const target=cost*rtp;let lo=0,hi=4,a=1,ws;
  for(let k=0;k<40;k++){a=(lo+hi)/2;ws=P.map(g=>Math.pow(g.price,-a));const W=ws.reduce((s,x)=>s+x,0);const ev=P.reduce((s,g,i)=>s+g.price*ws[i]/W,0);ev>target?lo=a:hi=a}
  let r=rand()*ws.reduce((s,x)=>s+x,0);for(let i=0;i<P.length;i++){if((r-=ws[i])<=0)return P[i]}return P[0];
 }
 function fitW(slugs,cost,rtp){const L=slugs.filter(x=>giftBy(x));const pr=L.map(x=>giftBy(x).price);if(!L.length)return[];const target=cost*rtp;
  if(!(target>Math.min(...pr)&&target<Math.max(...pr))){return L.map((x,i)=>[x,+(1/pr[i]/pr[i]*1e6).toFixed(3)])}
  let lo=-8,hi=8,ws;for(let k=0;k<60;k++){const a=(lo+hi)/2;ws=pr.map(x=>Math.pow(x,-a));const W=ws.reduce((x,y)=>x+y,0);const ev=pr.reduce((x,v,i)=>x+v*ws[i]/W,0);ev>target?lo=a:hi=a}
  const W=ws.reduce((x,y)=>x+y,0);return L.map((x,i)=>[x,+(ws[i]/W*100).toFixed(3)])}
 const _fitC={};
 function caseObj([n,p,s,l,defItems,glow,badge,title,fcost],free){const a=A();GIFTS();const c=(a.caseCfg||{})[n]||{};const price=free?0:(c.p??(a.caseP||{})[n]??p);
  let items=c.items&&c.items.length?c.items:null;
  if(!items&&defItems&&Array.isArray(defItems[0]))items=defItems;
  if(!items&&defItems){const k=n+price+R('cases')+_GK;items=_fitC[k]||(_fitC[k]=fitW(defItems,free?(fcost||60):price,free?.5:R('cases')))}
  const art=(items||[]).map(x=>giftBy(x[0])).filter(Boolean).sort((a,b)=>b.price-a.price);
  return {n,p:price,g:giftBy(c.cover)||art[0]||giftBy(s),art,l:c.lim??!!l,items,hidden:!!c.hidden,free:!!free,custom:(a.customCases||[]).some(x=>x[0]===n),glow:glow||'#0ea5e9',badge:badge||'',title:title||'',cover:c.cover}}
 const ALL_CASES=()=>[...CASE_DEF,...(A().customCases||[])].map(d=>caseObj(d));
 const CASES=()=>ALL_CASES().filter(c=>!c.hidden);
 const FREE=k=>caseObj(FREE_DEF[k==='tick'?1:k==='ref'?2:0],1);
 function itemsPick(items){const L=items.filter(([s])=>giftBy(s));let r=rand()*L.reduce((a,[,w])=>a+w,0);for(const [s,w] of L){if((r-=w)<=0)return giftBy(s)}return giftBy(L[0][0])}
 function autoDist(cost,rtp){const pool=GIFTS().filter(g=>(isStar(g)?g.price<cost:g.price>=cost*.15)&&g.price<=cost*40);const P=pool.length?pool:GIFTS();const target=cost*rtp;let lo=0,hi=4,ws=[];
  for(let k=0;k<40;k++){const a=(lo+hi)/2;ws=P.map(g=>Math.pow(g.price,-a));const W=ws.reduce((x,y)=>x+y,0);const ev=P.reduce((x,g,i)=>x+g.price*ws[i]/W,0);ev>target?lo=a:hi=a}
  const W=ws.reduce((x,y)=>x+y,0);return P.map((g,i)=>[g.slug,+(ws[i]/W*100).toFixed(2)]).sort((a,b)=>b[1]-a[1])}
 const caseGift=c=>c.items&&c.items.length?itemsPick(c.items):pickGift(c.p||100,c.free?.5:R('cases'));
 const caseDist=c=>c.items||autoDist(c.p||100,c.free?.5:R('cases'));
 /* plinko: множители подогнаны так, чтобы средний возврат = RTP */
 const PM=r=>{const ev=PM0[r].reduce((s,v,i)=>s+v*BIN[i],0);return PM0[r].map(v=>+(v*R('plinko')/ev).toFixed(2))};
 const plinkoBin=()=>{let k=0;for(let i=0;i<8;i++)if(rand()<.5)k++;return k};
 /* мины */
 const minesBombs=n=>Math.max(1,Math.round(n*n/5));
 const minesMult=(n,open)=>{const N=n*n,k=minesBombs(n);let p=1;for(let i=0;i<open;i++)p*=(N-k-i)/(N-i);return R('mines')/p};
 /* слоты */
 const slotsMult=res=>{const u=new Set(res).size;return (u===1?10:u===2?2:0)*R('slots')/.9};
 /* апгрейд */
 const upChance=(a,b)=>Math.min(95,a/b*R('upgrade')*100);
 /* краш: P(дойти до x) = RTP/x */
 const crashPoint=()=>Math.max(1,Math.floor(100*R('crash')/(1-rand()))/100);
 const crashMult=sec=>Math.pow(Math.E,CRASH_K*Math.max(0,sec));
 return {R,GIFTS,giftBy,pickGift,fitW,caseObj,ALL_CASES,CASES,FREE,itemsPick,autoDist,caseGift,caseDist,PM,plinkoBin,minesBombs,minesMult,slotsMult,upChance,crashPoint,crashMult};
}

/* ===== ШАХТА: общая симуляция (сервер считает выигрыш, мини-апп проигрывает те же события) ===== */
const DIG_W=7, DIG_TIER=[100,150,250], DIG_TIER_P=[.6,.3,.1], DIG_KS=[1,2,5,10];
const DIG_HARD={g:1,d:1,v:1,s:2,c:2,p:3,C:3,I:3,R:3,L:3,G:3,D:4,E:4,T:1,W:2,O:1e9};
const DIG_VAL={C:.1,I:.2,R:.3,L:.4,G:.6,D:4,E:15};
const DIG_ORE_P=[['C',.07],['I',.045],['R',.035],['L',.025],['G',.018],['D',.005],['E',.002],['T',.006],['W',.005]];
let DIG_MT={1:[4.8362,8.2721,12.5187],2:[5.1079,8.582,12.9443],5:[5.2878,8.8706,13.0848],10:[5.393,8.9409,13.2085]};   // средний «сырой» выигрыш за игру по каждой кирке (калибровка)
function digGen(rand,K){const H=150,rows=[];
 for(let y=0;y<H;y++){let r='';for(let x=0;x<DIG_W;x++){let ch;
  if(y===0)ch='g';else if(y<3)ch=rand()<.7?'d':'v';
  else{const deep=y/H;ch=rand()<deep*.8?'p':rand()<.25?'c':rand()<.1?'v':'s';
   const q=rand();let a=0;for(const [o,pr] of DIG_ORE_P){a+=pr*(DIG_VAL[o]?1/K:1)*(o==='D'||o==='E'?(.5+deep):1);if(q<a){ch=o;break}}}
  r+=ch}rows.push(r)}
 rows.push('OOOOOOO');
 return {rows,mv:Array.from({length:400},()=>{const q=rand();return q<.12?-1:q<.24?1:0}),x0:2+Math.floor(rand()*3)}}
function digSim(w,tier,K){const H=w.rows.length,g=w.rows.map(r=>r.split('')),hp=g.map(r=>r.map(ch=>DIG_HARD[ch]||0)),ev=[];
 let x=w.x0,y=-1,t=tier,php=DIG_TIER[t],mi=0,raw=0,side=0;
 const brk=(cx,cy,tnt)=>{const ch=g[cy][cx];if(ch==='.'||ch==='O')return;g[cy][cx]='.';hp[cy][cx]=0;const v=(DIG_VAL[ch]||0)*K;raw+=v;ev.push({e:'b',x:cx,y:cy,t:ch,v});
  if(ch==='W'){if(t<2){t++;php=DIG_TIER[t];ev.push({e:'u',t,hp:php,up:1})}else{php=DIG_TIER[2];ev.push({e:'u',t,hp:php,up:0})}}
  if(ch==='T'&&!tnt){ev.push({e:'x',x:cx,y:cy});for(let yy=cy;yy<Math.min(H-1,cy+4);yy++)for(let xx=Math.max(0,cx-1);xx<=Math.min(DIG_W-1,cx+1);xx++)brk(xx,yy,1);ev.push({e:'xe'})}   /* взрыв 3×4 */};
 for(let it=0;it<20000;it++){
  if(php<=0||y+1>=H-1&&!side)break;
  const tx=side?x+side:x,ty=side?y:y+1;
  if(!side&&g[ty][tx]==='.'){y++;ev.push({e:'f',x,y});continue}
  if(g[ty][tx]==='O')break;
  php--;hp[ty][tx]--;ev.push({e:'h',x:tx,y:ty,p:php,d:1-hp[ty][tx]/(DIG_HARD[g[ty][tx]]||1)});
  if(hp[ty][tx]<=0){brk(tx,ty,0);
   if(side){x+=side;side=0;ev.push({e:'m',x,y})}
   else{const m=w.mv[mi++%w.mv.length];if(m&&y>=0&&x+m>=0&&x+m<DIG_W){if(g[y][x+m]==='.'){x+=m;ev.push({e:'m',x,y})}else if(g[y][x+m]!=='O')side=m}}}}
 ev.push({e:'end',p:php});return {ev,raw}}
function digTierP(tp){const a=(tp&&tp.length===3?tp:[60,30,10]).map(v=>Math.max(0,+v||0));const s=a[0]+a[1]+a[2]||1;return a.map(v=>v/s)}
// средний выигрыш при заданных шансах кирок (линейно по каждой кирке)
function digM(K,tp){const p=digTierP(tp),m=DIG_MT[K];return p[0]*m[0]+p[1]*m[1]+p[2]*m[2]}
function digRun(rand,K,tp,force){const p=digTierP(tp),r=rand();const tier=force!=null?force:r<p[0]?0:r<p[0]+p[1]?1:2;const world=digGen(rand,K);return {tier,world,...digSim(world,tier,K)}}
// сумма выплаты: округляется только итог (у руд в мини-аппе — дробные значения)
function digPay(ev,bet,unit){let s=0;for(const e of ev)if(e.e==='b'&&e.v)s+=e.v;return Math.round(bet*s*unit)}
G.STRELA={digGen,digSim,digRun,digPay,DIG_KS,DIG_TIER,DIG_VAL,digM,digTierP,makeLogic,DEF_TASKS,GIFT_LIST,REG_LIST,CASE_DEF,FREE_DEF,EGGS,PM0,SLOT_SYMS,PVP_BETS,SLOT_BET,CRASH_K,isStar};
})(globalThis);

/* STRELA CASE — общий каталог подарков и логика игр.
   Этот файл используют И мини-апп (site/index.html), И сервер (worker.js),
   поэтому шансы и цены везде одинаковые. Результат игры всегда решает сервер. */
(function (G) {
const REG_LIST=[["r_heart", "Сердце", 15, "5170145012310081615", "💝"], ["r_bear", "Мишка", 15, "5170233102089322756", "🧸"], ["r_box", "Подарок", 25, "5170250947678437525", "🎁"], ["r_rose", "Роза", 25, "5168103777563050263", "🌹"], ["r_cake", "Торт", 50, "5170144170496491616", "🎂"], ["r_bouquet", "Букет", 50, "5170314324215857265", "💐"], ["r_rocket", "Ракета", 50, "5170564780938756245", "🚀"], ["r_champagne", "Шампанское", 50, "6028601630662853006", "🍾"], ["r_trophy", "Кубок", 100, "5168043875654172773", "🏆"], ["r_ring", "Кольцо", 100, "5170690322832818290", "💍"], ["r_gem", "Алмаз", 100, "5170521118301225164", "💎"]];
const NFT_LIST=[["plushpepe", "Plush Pepe", 999900], ["heartlocket", "Heart Locket", 206850], ["durovscap", "Durov's Cap", 67500], ["preciouspeach", "Precious Peach", 44850], ["scaredcat", "Scared Cat", 42750], ["heroichelmet", "Heroic Helmet", 36000], ["astralshard", "Astral Shard", 22350], ["lootbag", "Loot Bag", 21750], ["mightyarm", "Mighty Arm", 19500], ["nailbracelet", "Nail Bracelet", 18150], ["durovsglasses", "Durov's Glasses", 17850], ["westsidesign", "Westside Sign", 16800], ["minioscar", "Mini Oscar", 11700], ["iongem", "Ion Gem", 11100], ["perfumebottle", "Perfume Bottle", 10950], ["artisanbrick", "Artisan Brick", 10500], ["gemsignet", "Gem Signet", 10200], ["magicpotion", "Magic Potion", 9750], ["lowrider", "Low Rider", 9450], ["swisswatch", "Swiss Watch", 8400], ["kissedfrog", "Kissed Frog", 7500], ["sharptongue", "Sharp Tongue", 7350], ["bondedring", "Bonded Ring", 7050], ["vintagecigar", "Vintage Cigar", 6150], ["voodoodoll", "Voodoo Doll", 5850], ["signetring", "Signet Ring", 5700], ["nekohelmet", "Neko Helmet", 5700], ["genielamp", "Genie Lamp", 5400], ["toybear", "Toy Bear", 5250], ["diamondring", "Diamond Ring", 4950], ["blingbinky", "Bling Binky", 4500], ["rarebird", "Rare Bird", 4500], ["khabibspapakha", "Khabib's Papakha", 4350], ["electricskull", "Electric Skull", 4350], ["eternalrose", "Eternal Rose", 4200], ["cupidcharm", "Cupid Charm", 3450], ["skystilettos", "Sky Stilettos", 2850], ["trappedheart", "Trapped Heart", 2700], ["ufcstrike", "UFC Strike", 2550], ["ionicdryer", "Ionic Dryer", 2400], ["snoopcigar", "Snoop Cigar", 2400], ["lovepotion", "Love Potion", 2250], ["crystalball", "Crystal Ball", 2100], ["madpumpkin", "Mad Pumpkin", 2100], ["flyingbroom", "Flying Broom", 1950], ["recordplayer", "Record Player", 1950], ["skullflower", "Skull Flower", 1950], ["valentinebox", "Valentine Box", 1800], ["lovecandle", "Love Candle", 1650], ["tophat", "Top Hat", 1650], ["sakuraflower", "Sakura Flower", 1650], ["hangingstar", "Hanging Star", 1500], ["jinglebells", "Jingle Bells", 1500], ["berrybox", "Berry Box", 1350], ["bunnymuffin", "Bunny Muffin", 1350], ["evileye", "Evil Eye", 1350], ["jellybunny", "Jelly Bunny", 1350], ["surgeboard", "Surge Board", 1200], ["joyfulbundle", "Joyful Bundle", 1200], ["sleighbell", "Sleigh Bell", 1200], ["jollychimp", "Jolly Chimp", 1200], ["inputkey", "Input Key", 1050], ["moonpendant", "Moon Pendant", 1050], ["witchhat", "Witch Hat", 1050], ["lushbouquet", "Lush Bouquet", 1050], ["lightsword", "Light Sword", 1050], ["prettyposy", "Pretty Posy", 900], ["snowglobe", "Snow Globe", 900], ["eternalcandle", "Eternal Candle", 900], ["spyagaric", "Spy Agaric", 900], ["bowtie", "Bow Tie", 900], ["snowmittens", "Snow Mittens", 900], ["springbasket", "Spring Basket", 900], ["stellarrocket", "Stellar Rocket", 900], ["santahat", "Santa Hat", 900], ["restlessjar", "Restless Jar", 900], ["moneypot", "Money Pot", 900], ["moussecake", "Mousse Cake", 900], ["swagbag", "Swag Bag", 900], ["faithamulet", "Faith Amulet", 900], ["deskcalendar", "Desk Calendar", 900], ["homemadecake", "Homemade Cake", 900], ["partysparkler", "Party Sparkler", 900], ["snoopdogg", "Snoop Dogg", 900], ["cloverpin", "Clover Pin", 900], ["moodpack", "Mood Pack", 750], ["timelessbook", "Timeless Book", 750], ["libertyfigure", "Liberty Figure", 750], ["lunarsnake", "Lunar Snake", 750], ["jackinthebox", "Jack-in-the-Box", 750], ["starnotepad", "Star Notepad", 750], ["poolfloat", "Pool Float", 750], ["victorymedal", "Victory Medal", 750], ["cookieheart", "Cookie Heart", 750], ["hypnolollipop", "Hypno Lollipop", 750], ["gingercookie", "Ginger Cookie", 750], ["spicedwine", "Spiced Wine", 750], ["hexpot", "Hex Pot", 750], ["winterwreath", "Winter Wreath", 750], ["easteregg", "Easter Egg", 750], ["tamagadget", "Tama Gadget", 750], ["petsnake", "Pet Snake", 750], ["bigyear", "Big Year", 750], ["snakebox", "Snake Box", 750], ["holidaydrink", "Holiday Drink", 750], ["freshsocks", "Fresh Socks", 750], ["vicecream", "Vice Cream", 750], ["bdaycandle", "B-Day Candle", 750], ["lolpop", "Lol Pop", 750], ["jesterhat", "Jester Hat", 750], ["xmasstocking", "Xmas Stocking", 750], ["whipcupcake", "Whip Cupcake", 750], ["instantramen", "Instant Ramen", 750], ["happybrownie", "Happy Brownie", 750], ["icecream", "Ice Cream", 750], ["chillflame", "Chill Flame", 600], ["candycane", "Candy Cane", 600], ["algorithmcup", "Algorithm Cup", 517500], ["intelligencecup", "Intelligence Cup", 464850], ["resistancedog", "Resistance Dog", 89850], ["luckylocket", "Lucky Locket", 2550], ["finepen", "Fine Pen", 1350], ["miragelamp", "Mirage Lamp", 750], ["mythmask", "Myth Mask", 3000]];
/* цена NFT на Fragment в TON (floor, 2026-11-05); в ★ = TON × курс бота (Админ → Оплата → ★ за 1 TON) */
const NFT_TON={"mythmask":20,"algorithmcup":3450.0,"artisanbrick":83.0,"astralshard":147.0,"bdaycandle":5.0,"berrybox":10.0,"bigyear":5.0,"blingbinky":29.0,"bondedring":49.0,"bowtie":7.0,"bunnymuffin":9.0,"candycane":5.0,"chillflame":5.0,"cloverpin":6.0,"cookieheart":6.0,"crystalball":14.0,"cupidcharm":27.0,"deskcalendar":7.0,"diamondring":37.0,"durovscap":463.0,"durovsglasses":150.0,"easteregg":5.0,"electricskull":35.0,"eternalcandle":7.0,"eternalrose":33.0,"evileye":9.0,"faithamulet":7.0,"finepen":9.0,"flyingbroom":15.0,"freshsocks":6.0,"gemsignet":73.0,"genielamp":38.0,"gingercookie":6.0,"hangingstar":11.0,"happybrownie":5.0,"heartlocket":1444.0,"heroichelmet":250.0,"hexpot":7.0,"holidaydrink":6.0,"homemadecake":6.0,"hypnolollipop":6.0,"icecream":5.0,"inputkey":7.0,"instantramen":5.0,"intelligencecup":3099.0,"iongem":85.0,"ionicdryer":18.0,"jackinthebox":6.0,"jellybunny":10.0,"jesterhat":5.0,"jinglebells":11.0,"jollychimp":8.0,"joyfulbundle":11.0,"khabibspapakha":29.0,"kissedfrog":67.0,"libertyfigure":6.0,"lightsword":7.0,"lolpop":5.0,"lootbag":145.0,"lovecandle":13.0,"lovepotion":17.0,"lowrider":70.0,"luckylocket":17.0,"lunarsnake":5.0,"lushbouquet":7.0,"madpumpkin":20.0,"magicpotion":75.0,"mightyarm":150.0,"minioscar":115.0,"miragelamp":5.0,"moneypot":6.0,"moodpack":5.0,"moonpendant":7.0,"moussecake":6.0,"nailbracelet":149.0,"nekohelmet":42.0,"partysparkler":6.0,"perfumebottle":100.0,"petsnake":5.0,"plushpepe":7500.0,"poolfloat":5.0,"preciouspeach":295.0,"prettyposy":6.0,"recordplayer":13.0,"resistancedog":599.0,"restlessjar":6.0,"sakuraflower":12.0,"santahat":7.0,"scaredcat":295.0,"sharptongue":59.0,"signetring":38.0,"skullflower":13.0,"skystilettos":20.0,"sleighbell":12.0,"snakebox":5.0,"snoopcigar":19.0,"snoopdogg":6.0,"snowglobe":8.0,"snowmittens":10.0,"spicedwine":6.0,"springbasket":7.0,"spyagaric":7.0,"starnotepad":6.0,"stellarrocket":6.0,"surgeboard":8.0,"swagbag":6.0,"swisswatch":75.0,"tamagadget":5.0,"timelessbook":5.0,"tophat":12.0,"toybear":37.0,"trappedheart":18.0,"ufcstrike":18.0,"valentinebox":14.0,"vicecream":5.0,"victorymedal":6.0,"vintagecigar":49.0,"voodoodoll":43.0,"westsidesign":128.0,"whipcupcake":5.0,"winterwreath":6.0,"witchhat":9.0,"xmasstocking":5.0};
/* подарки с конкретной моделью: [slug, название, цена, коллекция, модель] */
const MODEL_LIST=[["vicecream_punkrock","Vice Cream · Punk Rock",430,"vicecream","Punk Rock"],["poolfloat_baywatch","Pool Float · Baywatch",900,"poolfloat","Baywatch"],["poolfloat_peachshake","Pool Float · Peach Shake",500,"poolfloat","Peach Shake"],["libertyfigure_marilyn","Liberty Figure · Marilyn",2100,"libertyfigure","Marilyn"],["libertyfigure_baywatch","Liberty Figure · Baywatch",900,"libertyfigure","Baywatch"],["stellarrocket_missionuranus","Stellar Rocket · Mission Uranus",13000,"stellarrocket","Mission Uranus"],["springbasket_bondage","Spring Basket · Bondage",10000,"springbasket","Bondage"],
 ["gingercookie_dracula","Ginger Cookie · Dracula",2000,"gingercookie","Dracula"],["gingercookie_ginger","Ginger Cookie · Ginger",550,"gingercookie","Ginger"],["petsnake_dracula","Pet Snake · Dracula",1300,"petsnake","Dracula"],["petsnake_spooky","Pet Snake · Spooky",2000,"petsnake","Spooky"],["candycane_demonius","Candy Cane · Demonius",430,"candycane","Demonius"],["candycane_sticky","Candy Cane · Sticky",450,"candycane","Sticky"],["lolpop_jinxed","Lol Pop · Jinxed",480,"lolpop","Jinxed"],["lolpop_mortalsin","Lol Pop · Mortal Sin",1000,"lolpop","Mortal Sin"],["lolpop_firevortex","Lol Pop · Fire Vortex",450,"lolpop","Fire Vortex"],["lolpop_pumpkin","Lol Pop · Pumpkin",480,"lolpop","Pumpkin"],["lunarsnake_souleater","Lunar Snake · Soul Eater",600,"lunarsnake","Soul Eater"],["lunarsnake_hellspawn","Lunar Snake · Hellspawn",462,"lunarsnake","Hellspawn"],["vicecream_pumpking","Vice Cream · Pumpking",434,"vicecream","Pumpking"]];
const GIFT_LIST=[
 ...REG_LIST.map(([s,n,p,id,e])=>[s,n,p,e,id]),
 ...NFT_LIST,
 ...MODEL_LIST.map(([s,n,p,b,m])=>[s,n,p,undefined,undefined,b,m]),
 ...[1500,1000,800,500,300,200,150,100,90,80,75,70,50,25,15,10,5].map(v=>['stars'+v,v+' звёзд',v,'⭐']),
];
const CASE_DEF=[["Halloween", 750, null, 1, [["candycane_demonius",9.52],["vicecream_pumpking",9.47],["candycane_sticky",9.28],["lolpop_firevortex",9.28],["lunarsnake_hellspawn",9.15],["lolpop_jinxed",8.95],["lolpop_pumpkin",8.95],["gingercookie_ginger",8.3],["lunarsnake_souleater",7.91],["lolpop_mortalsin",5.95],["petsnake_dracula",5.14],["gingercookie_dracula",4.04],["petsnake_spooky",4.04]], "#ff6a1a", "lim", ""], ["Mini Stars", 90, null, 0, [["stars50",28],["stars70",22],["stars80",17],["stars90",13],["stars100",10],["stars150",6],["stars200",4]], "#f2b31a", "new", ""], ["Stars Case", 500, null, 0, [["stars100",32],["stars300",22],["stars500",20],["stars800",13],["stars1000",9],["stars1500",4]], "#ffcc33", "new", ""], ["Sexy Case", 600, null, 0, [["vicecream_punkrock",47],["poolfloat_peachshake",45],["poolfloat_baywatch",3],["libertyfigure_baywatch",3],["libertyfigure_marilyn",1.8],["stellarrocket_missionuranus",.1],["springbasket_bondage",.1]], "#ff2d6f", "18", ""], ["Мелочь", 25, null, 0, ["stars5","stars10","r_heart","r_bear","stars15","r_rose","r_box","stars25","r_cake","stars50","r_gem","lolpop"], "#34c3a0", "new", ""], ["Копилка", 55, null, 0, ["stars10","r_rose","stars25","r_cake","r_bouquet","stars50","r_trophy","r_ring","stars100","candycane","icecream"], "#ff8a3d", "new", ""], ["Сюрприз", 80, null, 0, ["r_box","r_cake","r_champagne","stars50","r_trophy","r_gem","stars100","instantramen","whipcupcake","bdaycandle"], "#c04dff", "new", ""], ["Сладости", 300, null, 0, ["stars100","r_trophy","r_gem","lolpop","candycane","icecream","whipcupcake","happybrownie","moussecake","cookieheart","homemadecake","berrybox"], "#ff5fa2", "new", ""], ["Вечеринка", 450, null, 0, ["stars100","r_champagne","stars300","partysparkler","bdaycandle","jesterhat","bigyear","jackinthebox","tophat","recordplayer"], "#ffb52e", "new", ""], ["Магия", 900, null, 0, ["stars300","stars500","hexpot","spyagaric","witchhat","evileye","crystalball","flyingbroom","genielamp","magicpotion","miragelamp"], "#7b5cf5", "new", ""], ["Ночь ужасов", 1100, null, 0, ["stars500","witchhat","evileye","skullflower","trappedheart","madpumpkin","mythmask","electricskull","voodoodoll","sharptongue"], "#ff4d2e", "new", ""], ["Удача", 1800, null, 0, ["stars500","stars1000","moneypot","cloverpin","faithamulet","evileye","luckylocket","rarebird","genielamp","kissedfrog"], "#2fd36b", "new", ""], ["Мода", 2200, null, 0, ["bowtie","freshsocks","finepen","sakuraflower","tophat","luckylocket","skystilettos","signetring","perfumebottle","nailbracelet"], "#ff7ad9", "new", ""], ["Плюш", 4500, null, 0, ["stars1000","stars1500","jellybunny","bunnymuffin","jollychimp","rarebird","toybear","scaredcat","preciouspeach"], "#d9a066", "new", ""], ["Кибер", 11400, null, 0, ["stars1500","inputkey","lightsword","surgeboard","electricskull","artisanbrick","iongem","astralshard","heroichelmet"], "#22d3ee", "new", ""], ["Кубок", 25000, null, 0, ["victorymedal","ufcstrike","minioscar","lootbag","mightyarm","heroichelmet","resistancedog","intelligencecup","algorithmcup"], "#ffcf3a", "new", ""], ["Farm", 38, null, 0, ["r_heart", "r_bear", "r_box", "r_rose", "r_cake", "r_gem", "lolpop"], "#7b3dff", "", "FARM"], ["Winter", 975, null, 0, ["candycane", "xmasstocking", "gingercookie", "spicedwine", "santahat", "jinglebells", "winterwreath", "snowmittens", "snowglobe", "sleighbell"], "#3fa7ff", "", ""], ["Love", 1200, null, 0, ["r_rose", "cookieheart", "valentinebox", "lovecandle", "cupidcharm", "lovepotion", "trappedheart", "eternalrose", "bondedring", "heartlocket"], "#ff3d8b", "", ""], ["Space", 1350, null, 0, ["stellarrocket", "starnotepad", "moonpendant", "hangingstar", "crystalball", "iongem", "astralshard"], "#4d6bff", "new", ""], ["Westside", 1500, null, 0, ["snoopdogg", "swagbag", "snoopcigar", "lowrider", "westsidesign"], "#22c55e", "", ""], ["Gold Rush", 2850, null, 0, ["moneypot", "diamondring", "signetring", "swisswatch", "bondedring", "gemsignet", "nailbracelet"], "#f2b31a", "new", ""], ["Champions", 3750, null, 0, ["victorymedal", "ufcstrike", "khabibspapakha", "mightyarm", "heroichelmet"], "#e0304a", "", ""], ["Durov", 7350, null, 0, ["toybear", "vintagecigar", "signetring", "swisswatch", "lootbag", "minioscar", "durovsglasses", "durovscap"], "#2e9cf2", "", ""], ["Legend", 11250, null, 0, ["nekohelmet", "kissedfrog", "scaredcat", "iongem", "astralshard", "preciouspeach", "durovscap", "heartlocket", "plushpepe"], "#9a4dff", "", ""]];
const FREE_DEF=[["Free 24h", 0, null, 0, [["stars5",380],["stars10",250],["stars15",150],["stars25",100],["stars50",60],["stars75",25],["stars100",20],["hangingstar",1e-6],["jellybunny",1e-6],["jollychimp",1e-6],["lightsword",1e-6],["moonpendant",1e-6],["prettyposy",1e-6],["hexpot",1e-6],["cookieheart",1e-6]], "#f2a20f", "", "FREE<em>24</em>"], ["Free", 0, null, 0, [["stars5",350],["stars10",250],["stars15",150],["stars25",120],["stars50",70],["stars100",40],["vintagecigar",.6],["bondedring",.5],["sharptongue",.5],["kissedfrog",.4],["heroichelmet",.08],["scaredcat",.06],["preciouspeach",.05]], "#16a88a", "", "FREE<em>🎫</em>"], ["Friends", 0, null, 0, ["r_cake", "r_rocket", "r_trophy", "r_ring", "r_gem", "lolpop", "instantramen", "deskcalendar"], "#ff3d8b", "new", "FRIENDS<em>×5</em>", 200]];
const EGGS=[['jellybunny','3 кокоса',249],['ionicdryer','3 кокоса',249],['crystalball','4 кокоса',349],['preciouspeach','5 кокосов',999],['heartlocket','5 кокосов',999],['plushpepe','5 кокосов',2999]];
const PM0=[[5.6,2.1,1.1,1,.5,1,1.1,2.1,5.6],[13,3,1.3,.7,.4,.7,1.3,3,13],[29,4,1.5,.3,.2,.3,1.5,4,29]];
const BIN=[1,8,28,56,70,56,28,8,1].map(x=>x/256);   // шансы лунок plinko (8 рядов)
const SLOT_SYMS=['🍉','🥥','🐚','🌺','🍹','💎'];
const DEF_RTP={cases:90,eggs:90,crash:95,mines:95,plinko:95,slots:90,upgrade:90,dig:90,chick:95};
/* Цыпа: [шанс пройти полосу, число полос] по сложности */
const CHICK_D=[[.9,20],[.8,16],[.7,12],[.55,9]]; // как в админке по умолчанию
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
 const R=g=>{const r=A().rtp||{};return (r[g]??(g==='contract'?r.upgrade:undefined)??DEF_RTP[g]??90)/100};   // контракты: пока не задан свой % — как у апгрейда
 const tonRate=()=>(+A().tonRate>0?+A().tonRate:150);
 const mkG=([slug,name,p,e,tgid,b,m])=>({slug,name,price:(A().prices||{})[slug]??(NFT_TON[slug]&&!m?Math.round(NFT_TON[slug]*tonRate()):p),e,tgid,reg:!!tgid,...(m?{b,m}:{})});
 let _GC=null,_GK='';
 const GIFTS=()=>{const a=A();const k=JSON.stringify([a.prices,a.giftOff,a.tonRate]);if(k!==_GK||!_GC){_GK=k;_GC=GIFT_LIST.filter(g=>!(a.giftOff||{})[g[0]]).map(mkG)}return _GC};
 const _GALL={};GIFT_LIST.forEach(g=>_GALL[g[0]]=g);
 const giftBy=s=>GIFTS().find(g=>g.slug===s)||(_GALL[s]?mkG(_GALL[s]):null);

 /* выбор подарка так, чтобы средний выигрыш = цена × RTP */
 /* один список призов для показа («Призы») и для выпадения: от 15% до x40 стоимости, звёзды — меньше стоимости */
 function prizePool(cost){return GIFTS().filter(g=>!g.m&&g.price>=cost*.15&&g.price<=cost*40&&(!isStar(g)||g.price<cost))}
 function pickGift(cost,rtp){
  const pool=prizePool(cost);const P=pool.length?pool:GIFTS();
  const target=cost*rtp;let lo=0,hi=4,a=1,ws;
  for(let k=0;k<40;k++){a=(lo+hi)/2;ws=P.map(g=>Math.pow(g.price,-a));const W=ws.reduce((s,x)=>s+x,0);const ev=P.reduce((s,g,i)=>s+g.price*ws[i]/W,0);ev>target?lo=a:hi=a}
  let r=rand()*ws.reduce((s,x)=>s+x,0);for(let i=0;i<P.length;i++){if((r-=ws[i])<=0)return P[i]}return P[0];
 }
 function fitW(slugs,cost,rtp){const L=slugs.filter(x=>giftBy(x));const pr=L.map(x=>giftBy(x).price);if(!L.length)return[];const target=cost*rtp;
  if(!(target>Math.min(...pr)&&target<Math.max(...pr))){return L.map((x,i)=>[x,+(1/pr[i]/pr[i]*1e6).toFixed(3)])}
  let lo=-8,hi=8,ws;for(let k=0;k<60;k++){const a=(lo+hi)/2;ws=pr.map(x=>Math.pow(x,-a));const W=ws.reduce((x,y)=>x+y,0);const ev=pr.reduce((x,v,i)=>x+v*ws[i]/W,0);ev>target?lo=a:hi=a}
  const W=ws.reduce((x,y)=>x+y,0);return L.map((x,i)=>[x,+(ws[i]/W*100).toFixed(3)])}
 const _fitC={};
 /* самый дешёвый подарок — самый частый: веса по убыванию раздаются подаркам по возрастанию цены */
 function monoW(items){const L=items.filter(([s])=>giftBy(s));if(L.length<2)return items;const ws=L.map(x=>+x[1]||0).sort((a,b)=>b-a);return L.map(x=>[x[0],giftBy(x[0]).price]).sort((a,b)=>a[1]-b[1]).map(([s],i)=>[s,ws[i]])}
 function caseObj([n,p,s,l,defItems,glow,badge,title,fcost],free){const a=A();GIFTS();const c=(a.caseCfg||{})[n]||{};const price=free?0:(c.p??(a.caseP||{})[n]??p);
  let items=c.items&&c.items.length?c.items:null;
  if(!items&&defItems&&Array.isArray(defItems[0]))items=defItems;
  if(!items&&defItems){const k=n+price+R('cases')+_GK;items=_fitC[k]||(_fitC[k]=fitW(defItems,free?(fcost||60):price,free?.5:R('cases')))}
  if(items)items=monoW(items);
  /* бесплатные кейсы: NFT только пролетают в ленте, выпасть не могут */
  if(items&&free){items=items.map(([s,w])=>{const g=giftBy(s);return [s,g&&!isStar(g)&&!g.reg?0:w]});if(!items.some(x=>x[1]>0))items=[...items,['stars5',1]]}
  const art=(items||[]).map(x=>giftBy(x[0])).filter(Boolean).sort((a,b)=>b.price-a.price);
  return {n,p:price,g:giftBy(c.cover)||art[0]||giftBy(s),art,l:c.lim??!!l,items,hidden:!!c.hidden,del:!!c.del,free:!!free,custom:(a.customCases||[]).some(x=>x[0]===n),cat:c.cat||'',glow:glow||'#0ea5e9',badge:badge||'',title:title||'',cover:c.cover}}
 const ALL_CASES=()=>[...CASE_DEF,...(A().customCases||[])].map(d=>caseObj(d)).filter(c=>!c.del);   // удалённые в админке — убраны совсем
 const CASES=()=>ALL_CASES().filter(c=>!c.hidden);
 const FREE=k=>caseObj(FREE_DEF[k==='tick'?1:k==='ref'?2:0],1);
 const FREE_KEYS=()=>['daily','tick','ref'].filter(k=>!FREE(k).del);   // бесплатные, не удалённые в админке
 function itemsPick(items){const L0=items.filter(([s])=>giftBy(s)),L=L0.some(x=>x[1]>0)?L0.filter(x=>x[1]>0):L0;   // вес 0 = только витрина, не выпадает
 let r=rand()*L.reduce((a,[,w])=>a+w,0);for(const [s,w] of L){if((r-=w)<=0)return giftBy(s)}return giftBy(L[0][0])}
 function autoDist(cost,rtp){const pool=prizePool(cost);const P=pool.length?pool:GIFTS();const target=cost*rtp;let lo=0,hi=4,ws=[];
  for(let k=0;k<40;k++){const a=(lo+hi)/2;ws=P.map(g=>Math.pow(g.price,-a));const W=ws.reduce((x,y)=>x+y,0);const ev=P.reduce((x,g,i)=>x+g.price*ws[i]/W,0);ev>target?lo=a:hi=a}
  const W=ws.reduce((x,y)=>x+y,0);return P.map((g,i)=>[g.slug,+(ws[i]/W*100).toFixed(2)]).sort((a,b)=>b[1]-a[1])}
 const caseGift=c=>c.items&&c.items.length?itemsPick(c.items):pickGift(c.p||100,c.free?.5:R('cases'));
 const caseDist=c=>c.items||autoDist(c.p||100,c.free?.5:R('cases'));
 /* plinko: множители подогнаны так, чтобы средний возврат = RTP */
 const PM=r=>{const ev=PM0[r].reduce((s,v,i)=>s+v*BIN[i],0);return PM0[r].map(v=>+(v*R('plinko')/ev).toFixed(2))};
 const plinkoBin=()=>{let k=0;for(let i=0;i<8;i++)if(rand()<.5)k++;return k};
 /* мины */
 const minesBombs=n=>Math.max(1,Math.round(n*n/5));
 const chickMult=(d,k)=>{const D=CHICK_D[d]||CHICK_D[0];return k?Math.floor(R('chick')/Math.pow(D[0],k)*100)/100:1};
 const minesMult=(n,open)=>{const N=n*n,k=minesBombs(n);let p=1;for(let i=0;i<open;i++)p*=(N-k-i)/(N-i);return R('mines')/p};
 /* слоты */
 const slotsMult=res=>{const u=new Set(res).size;return (u===1?10:u===2?2:0)*R('slots')/.9};
 /* апгрейд */
 const UP_MAX=()=>Math.min(95,Math.max(1,+A().upMax||95));   // потолок шанса апгрейда из админки (1–95%)
 const upChance=(a,b)=>Math.min(UP_MAX(),a/b*R('upgrade')*100);
 /* краш: P(дойти до x) = RTP/x */
 const crashPoint=()=>Math.max(1,Math.floor(100*R('crash')/(1-rand()))/100);
 const crashMult=sec=>Math.pow(Math.E,CRASH_K*Math.max(0,sec));
 return {R,UP_MAX,GIFTS,giftBy,pickGift,prizePool,fitW,caseObj,ALL_CASES,CASES,FREE,FREE_KEYS,itemsPick,MODEL_LIST,autoDist,caseGift,caseDist,PM,plinkoBin,minesBombs,minesMult,chickMult,slotsMult,upChance,crashPoint,crashMult};
}

/* ===== ШАХТА: общая симуляция (сервер считает выигрыш, мини-апп проигрывает те же события) ===== */
const DIG_W=7, DIG_TIER=[100,150,250], DIG_TIER_P=[.6,.3,.1], DIG_KS=[1,2,5,10];
const DIG_HARD={g:1,d:1,v:1,s:2,c:2,p:3,C:3,I:3,R:3,L:3,G:3,D:4,E:4,T:1,W:2,O:1e9};
const DIG_VAL={C:.1,I:.2,R:.3,L:.4,G:.6,D:4,E:15};
const DIG_ORE_P=[['C',.07],['I',.045],['R',.035],['L',.025],['G',.018],['D',.005],['E',.002],['T',.006],['W',.005]];
let DIG_MT={1:[3.5255,6.2889,9.9999],2:[3.5819,6.5513,10.6006],5:[3.6631,6.8731,10.6749],10:[3.6731,6.8973,11.2728]};   // средний «сырой» выигрыш за игру по каждой кирке (калибровка)
function digGen(rand,K){const H=150,rows=[];
 for(let y=0;y<H;y++){let r='';for(let x=0;x<DIG_W;x++){let ch;
  if(y===0)ch='g';else if(y<3)ch=rand()<.7?'d':'v';
  else{const deep=y/H;ch=rand()<deep*.8?'p':rand()<.25?'c':rand()<.1?'v':'s';
   const q=rand();let a=0;for(const [o,pr] of DIG_ORE_P){a+=pr*(DIG_VAL[o]?1/K:1)*(o==='D'||o==='E'?(.5+deep):1);if(q<a){ch=o;break}}}
  r+=ch}rows.push(r)}
 rows.push('OOOOOOO');
 return {rows,mv:Array.from({length:600},()=>{const q=rand();return q<.22?-1:q<.44?1:0}),x0:2+Math.floor(rand()*3),seed:1+Math.floor(rand()*2147483000)}}
/* ===== физика кирки: свободно летает по шахте как мячик (гравитация, отскоки во все стороны), ломает блоки, о которые бьётся.
   Только + − × ÷ и sqrt, свой генератор случайных чисел от seed мира → на сервере и в мини-аппе результат совпадает до бита ===== */
const DIG_DT=1/120,DIG_G=40,DIG_RAD=.4;
function digPhys(w,tier,K){const H=w.rows.length,g=w.rows.map(r=>r.split('')),hp=g.map(r=>r.map(ch=>DIG_HARD[ch]||0)),ev=[],cool={};
 let sd=((w.seed|0)%2147483646)+1;if(sd<1)sd+=2147483646;const R=()=>(sd=(sd*48271)%2147483647)/2147483647;
 const P={x:(w.x0|0)+.5,y:-1.5,vx:(R()-.5)*3,vy:0,a:0,w:(R()-.5)*24,t:tier,hp:DIG_TIER[tier],raw:0,time:0,done:0,ev,g};
 const end=()=>{if(!P.done){P.done=1;ev.push({e:'end',p:P.hp,t:P.time})}};
 const brk=(cx,cy,tnt)=>{const ch=g[cy][cx];if(ch==='.'||ch==='O')return;g[cy][cx]='.';hp[cy][cx]=0;const v=(DIG_VAL[ch]||0)*K;P.raw+=v;ev.push({e:'b',x:cx,y:cy,t:ch,v,tm:P.time});
  if(ch==='W'){if(P.t<2){P.t++;P.hp=DIG_TIER[P.t];ev.push({e:'u',t:P.t,hp:P.hp,up:1})}else{P.hp=DIG_TIER[2];ev.push({e:'u',t:P.t,hp:P.hp,up:0})}}
  if(ch==='T'&&!tnt){ev.push({e:'x',x:cx,y:cy});for(let yy=Math.max(0,cy-1);yy<=Math.min(H-2,cy+2);yy++)for(let xx=Math.max(0,cx-1);xx<=Math.min(DIG_W-1,cx+1);xx++)brk(xx,yy,1);ev.push({e:'xe'});
   P.vy-=10+R()*6;P.vx+=(R()-.5)*14}};   /* взрыв 3×4, кирку подбрасывает */
 const hit=(cx,cy)=>{P.hp--;hp[cy][cx]--;ev.push({e:'h',x:cx,y:cy,p:P.hp,d:1-hp[cy][cx]/(DIG_HARD[g[cy][cx]]||1)});if(hp[cy][cx]<=0)brk(cx,cy,0);if(P.hp<=0)end()};
 const bounce=(nX,nY,vn)=>{const e=.45;P.vx-=(1+e)*vn*nX;P.vy-=(1+e)*vn*nY;
  const cur=P.vx*nX+P.vy*nY,mn=nY<-.5?7+R()*6:3+R()*5;if(cur<mn){P.vx+=(mn-cur)*nX;P.vy+=(mn-cur)*nY}   /* от пола подпрыгивает выше, от стен/потолка слабее */
  const k=(R()-.5)*(nY<-.5?13:6);P.vx+=-nY*k;P.vy+=nX*k;P.w=(R()-.5)*36};
 P.step=()=>{if(P.done)return;P.time+=DIG_DT;
  P.vy+=DIG_G*DIG_DT;const sp=Math.sqrt(P.vx*P.vx+P.vy*P.vy);if(sp>24){P.vx*=24/sp;P.vy*=24/sp}
  P.x+=P.vx*DIG_DT;P.y+=P.vy*DIG_DT;P.a+=P.w*DIG_DT;
  if(P.y<-1.6){P.y=-1.6;if(P.vy<0)P.vy=-P.vy*.5}   /* выше неба не улетает */
  if(P.x<DIG_RAD){P.x=DIG_RAD;if(P.vx<0)P.vx=-P.vx*.7+1}if(P.x>DIG_W-DIG_RAD){P.x=DIG_W-DIG_RAD;if(P.vx>0)P.vx=-P.vx*.7-1}   /* боковые стенки шахты — не ломаются */
  for(let cy=Math.floor(P.y-DIG_RAD);cy<=Math.floor(P.y+DIG_RAD);cy++){if(cy<0||cy>=H)continue;
   for(let cx=Math.floor(P.x-DIG_RAD);cx<=Math.floor(P.x+DIG_RAD);cx++){if(cx<0||cx>=DIG_W)continue;const ch=g[cy][cx];if(ch==='.')continue;
    const nx=P.x<cx?cx:P.x>cx+1?cx+1:P.x,ny=P.y<cy?cy:P.y>cy+1?cy+1:P.y,dx=P.x-nx,dy=P.y-ny,d2=dx*dx+dy*dy;if(d2>=DIG_RAD*DIG_RAD)continue;
    let nX=0,nY=-1;if(d2>1e-9){const d=Math.sqrt(d2);nX=dx/d;nY=dy/d;P.x=nx+nX*DIG_RAD;P.y=ny+nY*DIG_RAD}else P.y=cy-DIG_RAD;
    const vn=P.vx*nX+P.vy*nY;if(vn>=0)continue;
    bounce(nX,nY,vn);
    if(ch!=='O'&&-vn>2&&P.time-(cool[cy*8+cx]||-9)>.08){cool[cy*8+cx]=P.time;hit(cx,cy);if(P.done)return}}}
  if(P.time>240||P.y>H-1.5)end()};
 return P}
function digSim(w,tier,K){const P=digPhys(w,tier,K);for(let i=0;i<120*300&&!P.done;i++)P.step();if(!P.done){P.done=1;P.ev.push({e:'end',p:P.hp})}return {ev:P.ev,raw:P.raw,T:P.time}}
function digTierP(tp){const a=(tp&&tp.length===3?tp:[60,30,10]).map(v=>Math.max(0,+v||0));const s=a[0]+a[1]+a[2]||1;return a.map(v=>v/s)}
// средний выигрыш при заданных шансах кирок (линейно по каждой кирке)
function digM(K,tp){const p=digTierP(tp),m=DIG_MT[K];return p[0]*m[0]+p[1]*m[1]+p[2]*m[2]}
function digRun(rand,K,tp,force){const p=digTierP(tp),r=rand();const tier=force!=null?force:r<p[0]?0:r<p[0]+p[1]?1:2;const world=digGen(rand,K);return {tier,world,...digSim(world,tier,K)}}
// сумма выплаты: округляется только итог (у руд в мини-аппе — дробные значения)
function digPay(ev,bet,unit){let s=0;for(const e of ev)if(e.e==='b'&&e.v)s+=e.v;return Math.round(bet*s*unit)}
/* уровни игрока: по обороту (сумме ставок), награда за каждый новый уровень */
const LEVELS=[['Рейтинг 1',0,0],['Рейтинг 2',1000,10],['Рейтинг 3',5000,40],['Рейтинг 4',20000,150],['Рейтинг 5',60000,400],['Рейтинг 6',200000,1200],['Рейтинг 7',600000,3500]];
G.STRELA={LEVELS,CHICK_D,digGen,digSim,digPhys,DIG_DT,digRun,digPay,DIG_KS,DIG_TIER,DIG_VAL,digM,digTierP,makeLogic,DEF_TASKS,GIFT_LIST,REG_LIST,CASE_DEF,FREE_DEF,EGGS,PM0,SLOT_SYMS,PVP_BETS,SLOT_BET,CRASH_K,isStar,MODEL_LIST,NFT_TON};
})(globalThis);

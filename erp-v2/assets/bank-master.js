(()=>{
  'use strict';
  const rows=[
    ['004','臺灣銀行','bank','Bank of Taiwan',['台灣銀行','台銀']],
    ['005','臺灣土地銀行','bank','Land Bank of Taiwan',['台灣土地銀行','土地銀行','土銀']],
    ['006','合作金庫商業銀行','bank','Taiwan Cooperative Bank',['合作金庫','合庫']],
    ['007','第一商業銀行','bank','First Commercial Bank',['第一銀行','一銀']],
    ['008','華南商業銀行','bank','Hua Nan Commercial Bank',['華南銀行','華銀']],
    ['009','彰化商業銀行','bank','Chang Hwa Commercial Bank',['彰化銀行','彰銀']],
    ['011','上海商業儲蓄銀行','bank','The Shanghai Commercial & Savings Bank',['上海商銀','上海銀行']],
    ['012','台北富邦商業銀行','bank','Taipei Fubon Commercial Bank',['台北富邦','富邦銀行','北富銀']],
    ['013','國泰世華商業銀行','bank','Cathay United Bank',['國泰世華','國泰銀行','世華銀行']],
    ['016','高雄銀行','bank','Bank of Kaohsiung',['高銀']],
    ['017','兆豐國際商業銀行','bank','Mega International Commercial Bank',['兆豐銀行','兆豐','Mega Bank']],
    ['018','全國農業金庫','bank','Agricultural Bank of Taiwan',['農業金庫','農金']],
    ['048','王道商業銀行','bank','O-Bank',['王道銀行','王道','O Bank']],
    ['050','臺灣中小企業銀行','bank','Taiwan Business Bank',['台灣中小企業銀行','臺灣企銀','台灣企銀','台企銀']],
    ['052','渣打國際商業銀行','bank','Standard Chartered Bank Taiwan',['渣打銀行','渣打','Standard Chartered']],
    ['053','台中商業銀行','bank','Taichung Commercial Bank',['台中銀行','台中銀']],
    ['054','京城商業銀行','bank','King’s Town Bank',['京城銀行','京城銀']],
    ['081','滙豐（台灣）商業銀行','bank','HSBC Bank Taiwan',['匯豐台灣','滙豐銀行','匯豐銀行','HSBC']],
    ['101','瑞興商業銀行','bank','Taipei Star Bank',['瑞興銀行','瑞興銀']],
    ['102','華泰商業銀行','bank','Hwatai Bank',['華泰銀行','華泰銀']],
    ['103','臺灣新光商業銀行','bank','Shin Kong Commercial Bank',['台灣新光商業銀行','新光銀行','新光銀']],
    ['108','陽信商業銀行','bank','Sunny Bank',['陽信銀行','陽信']],
    ['118','板信商業銀行','bank','Panchiao Credit Cooperative Bank',['板信銀行','板信']],
    ['147','三信商業銀行','bank','Cota Commercial Bank',['三信銀行','三信']],
    ['700','中華郵政','post','Chunghwa Post',['郵局','郵政','Post Office']],
    ['803','聯邦商業銀行','bank','Union Bank of Taiwan',['聯邦銀行','聯邦銀']],
    ['805','遠東國際商業銀行','bank','Far Eastern International Bank',['遠東銀行','遠東銀','FEIB']],
    ['806','元大商業銀行','bank','Yuanta Commercial Bank',['元大銀行','元大銀']],
    ['807','永豐商業銀行','bank','Bank SinoPac',['永豐銀行','永豐銀','SinoPac']],
    ['808','玉山商業銀行','bank','E.SUN Commercial Bank',['玉山銀行','玉山銀','E.SUN','ESUN']],
    ['809','凱基商業銀行','bank','KGI Bank',['凱基銀行','凱基','KGI']],
    ['810','星展（台灣）商業銀行','bank','DBS Bank Taiwan',['星展台灣','星展銀行','DBS']],
    ['812','台新國際商業銀行','bank','Taishin International Bank',['台新銀行','台新銀','Taishin']],
    ['816','安泰商業銀行','bank','Entie Commercial Bank',['安泰銀行','安泰銀']],
    ['822','中國信託商業銀行','bank','CTBC Bank',['中國信託','中信','中信銀行','CTBC']],
    ['823','將來商業銀行 NEXT BANK','digital_bank','NEXT BANK',['將來銀行','將來銀','NEXT']],
    ['824','連線商業銀行 LINE Bank','digital_bank','LINE Bank',['連線銀行','連線銀','LINE']],
    ['826','樂天國際商業銀行','digital_bank','Rakuten International Commercial Bank',['樂天銀行','樂天銀','Rakuten']],
    ['104','台北市第五信用合作社','credit_union','The Fifth Credit Cooperative of Taipei',['台北五信','第五信用合作社']],
    ['114','基隆第一信用合作社','credit_union','Keelung First Credit Cooperative',['基隆一信']],
    ['115','基隆市第二信用合作社','credit_union','Keelung Second Credit Cooperative',['基隆二信']],
    ['119','淡水第一信用合作社','credit_union','Tamsui First Credit Cooperative',['淡水一信']],
    ['120','新北市淡水信用合作社','credit_union','New Taipei Tamsui Credit Cooperative',['淡水信用合作社','淡水信合社']],
    ['124','宜蘭信用合作社','credit_union','Yilan Credit Cooperative',['宜蘭信合社']],
    ['127','桃園信用合作社','credit_union','Taoyuan Credit Cooperative',['桃園信合社','桃園信用']],
    ['130','新竹第一信用合作社','credit_union','Hsinchu First Credit Cooperative',['新竹一信']],
    ['132','新竹第三信用合作社','credit_union','Hsinchu Third Credit Cooperative',['新竹三信']],
    ['146','台中市第二信用合作社','credit_union','Taichung Second Credit Cooperative',['台中二信']],
    ['158','彰化第一信用合作社','credit_union','Changhua First Credit Cooperative',['彰化一信']],
    ['161','彰化第五信用合作社','credit_union','Changhua Fifth Credit Cooperative',['彰化五信']],
    ['162','彰化第六信用合作社','credit_union','Changhua Sixth Credit Cooperative',['彰化六信']],
    ['163','彰化第十信用合作社','credit_union','Changhua Tenth Credit Cooperative',['彰化十信']],
    ['165','彰化縣鹿港信用合作社','credit_union','Lukang Credit Cooperative',['鹿港信用合作社','鹿港信合社']],
    ['178','嘉義市第三信用合作社','credit_union','Chiayi Third Credit Cooperative',['嘉義三信']],
    ['188','台南第三信用合作社','credit_union','Tainan Third Credit Cooperative',['台南三信']],
    ['204','高雄市第三信用合作社','credit_union','Kaohsiung Third Credit Cooperative',['高雄三信']],
    ['215','花蓮第一信用合作社','credit_union','Hualien First Credit Cooperative',['花蓮一信']],
    ['216','花蓮第二信用合作社','credit_union','Hualien Second Credit Cooperative',['花蓮二信']],
    ['600','農金資訊－農漁會信用部','agri_fish','Agricultural and Fishery Credit Information Center',['農金資訊','農漁會信用部','農會','漁會']],
    ['952','農漁會南區資訊中心','agri_fish','Agricultural and Fishery South Information Center',['農漁會南區','南區資訊中心']],
    ['997','信用合作社聯合資訊處理中心','credit_union_center','Credit Cooperative Joint Information Center',['信用合作社聯合中心','信合社聯合中心']]
  ];
  const normalize=value=>String(value??'').trim().toLowerCase().replace(/[\s　()（）·．.\-_/／&＆]+/g,'');
  const master=Object.freeze(rows.map(([code,name,type,english,aliases])=>Object.freeze({
    code:String(code),name,type,english,aliases:Object.freeze(aliases),
    label:`${code} ${name}`,
    searchText:normalize([code,name,english,...aliases].join(' '))
  })));
  const byCode=new Map(master.map(bank=>[bank.code,bank]));
  const search=(query,limit=20)=>{
    const keyword=normalize(query);
    if(!keyword)return master.slice(0,limit);
    return master.filter(bank=>bank.searchText.includes(keyword)).slice(0,limit);
  };
  const resolve=value=>{
    const text=String(value??'').trim();
    if(!text)return null;
    const exact=byCode.get(text.padStart(3,'0'));if(exact)return exact;
    const matches=search(text,2);return matches.length===1?matches[0]:null;
  };
  window.BANK_MASTER=master;
  window.BankMaster=Object.freeze({all:master,find:code=>byCode.get(String(code??'').padStart(3,'0'))||null,search,resolve,options:Object.freeze(master.map(bank=>Object.freeze([bank.code,bank.label])))});
})();

/* Historical schedule import: pure validation before any editor is changed. */
(function(root){
  'use strict';
  const clean=value=>String(value??'').normalize('NFKC').replace(/\s+/g,'').trim();
  const noHeaders=new Set(['工號','員工編號','員工代碼','員編']);
  const nameHeaders=new Set(['姓名','員工姓名','人員姓名','同仁姓名']);
  function monthValue(value){
    const text=clean(value),match=text.match(/^(?:民國)?(\d{2,4})(?:年|[\/.-])(\d{1,2})(?:月|(?:[\/.-]\d{1,2}))?$/);
    if(!match)return '';
    let year=Number(match[1]);if(year<1911)year+=1911;
    const month=Number(match[2]);return month>=1&&month<=12?`${year}-${String(month).padStart(2,'0')}`:'';
  }
  function dayValue(value,month){
    const text=clean(value).replace(/[（(](?:週|星期)?[日一二三四五六天][)）]$/,''),[year,m]=month.split('-').map(Number),days=new Date(year,m,0).getDate();
    let match=text.match(/^(\d{2,4})(?:年|[\/.-])(\d{1,2})(?:月|[\/.-])(\d{1,2})日?$/),day;
    if(match){let y=Number(match[1]);if(y<1911)y+=1911;if(y!==year||Number(match[2])!==m)return 0;day=Number(match[3]);}
    else if((match=text.match(/^(\d{1,2})(?:月|[\/.-])(\d{1,2})日?$/))){if(Number(match[1])!==m)return 0;day=Number(match[2]);}
    else if((match=text.match(/^(\d{1,2})日?$/)))day=Number(match[1]);
    return day>=1&&day<=days?day:0;
  }
  function inspect(grid,month){
    const headerIndex=grid.findIndex(row=>row.some(value=>noHeaders.has(clean(value))||nameHeaders.has(clean(value)))&&row.some(value=>dayValue(value,month)));
    if(headerIndex<0)return null;
    const header=grid[headerIndex],noIndex=header.findIndex(value=>noHeaders.has(clean(value))),nameIndex=header.findIndex(value=>nameHeaders.has(clean(value)));
    const columns=header.map((value,index)=>({index,day:dayValue(value,month)})).filter(x=>x.day&&x.index!==noIndex&&x.index!==nameIndex);
    if(new Set(columns.map(x=>x.day)).size!==columns.length)throw Error('日期欄位重複，請保留每個日期一欄。');
    return{headerIndex,noIndex,nameIndex,columns};
  }
  function parse(grid,{month,siteName,employees,parseShift}){
    const meta=grid.find(row=>['月份','排班月份'].includes(clean(row[0]))),declared=meta?monthValue(meta[1]):'';
    if(meta&&clean(meta[1])&&!declared)throw Error('無法辨識檔案月份，請使用 2026-08 或 115年8月格式。');
    if(declared&&declared!==month)throw Error(`檔案月份為 ${declared}，請先將排班月份切換為 ${declared}。`);
    const metaSite=grid.find(row=>['案場','案場名稱','社區名稱'].includes(clean(row[0])))?.[1];
    if(metaSite&&clean(metaSite)!==clean(siteName))throw Error(`檔案案場為「${metaSite}」，與目前選取案場不同。`);
    const layout=inspect(grid,month);if(!layout)throw Error('找不到人員及日期標題列，需有「工號／員工編號」或「姓名」，日期可用 1、8/1、2026-08-01。');
    const {headerIndex,noIndex,nameIndex,columns}=layout,changes=[],people=new Map(),errors=[],seen=new Set();
    for(let index=headerIndex+1;index<grid.length;index++){
      const row=grid[index],no=noIndex<0?'':clean(row[noIndex]).toUpperCase(),name=nameIndex<0?'':clean(row[nameIndex]);
      if(!no&&!name)continue;
      if(['合計','總計','備註','勤務方式','填寫說明'].includes(no||name))continue;
      const matches=employees.filter(e=>no?clean(e.employee_no).toUpperCase()===no:clean(e.full_name)===name);
      if(matches.length!==1){errors.push(`第 ${index+1} 列：${no||name}${matches.length?'姓名重複，請補上工號':'找不到員工資料'}`);continue;}
      const employee=matches[0];
      if(no&&name&&clean(employee.full_name)!==name){errors.push(`第 ${index+1} 列：工號與姓名不一致`);continue;}
      if(seen.has(employee.id)){errors.push(`第 ${index+1} 列：${no||name} 重複，請將同一人的日期整理在同一列`);continue;}
      seen.add(employee.id);people.set(employee.id,employee);
      for(const column of columns){const parsed=parseShift(row[column.index]);if(parsed.error)errors.push(`第 ${index+1} 列 ${column.day} 日：${parsed.error}`);else changes.push({employeeId:employee.id,day:column.day,...parsed});}
    }
    if(errors.length)throw Error(`${errors.slice(0,6).join('；')}${errors.length>6?`；另有 ${errors.length-6} 項錯誤`:''}。班表尚未變更。`);
    if(!people.size||!changes.length)throw Error('檔案沒有可匯入的人員或日期。');
    return{employees:[...people.values()],changes};
  }
  root.HongJiaScheduleImport={clean,monthValue,dayValue,inspect,parse};
})(typeof window==='undefined'?globalThis:window);

const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+__dirname+'/'+(process.argv[2]||'stichpunkte')+'.html');
await p.pdf({path:__dirname+'/'+(process.argv[3]||'Newsflash_Stichpunkte')+'.pdf',preferCSSPageSize:true,printBackground:true});await b.close();})();

const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+__dirname+'/sprechzettel.html');
await p.pdf({path:__dirname+'/Newsflash_Sprechzettel_einfach.pdf',preferCSSPageSize:true,printBackground:true});await b.close();})();

const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
for(const [f,o,opt] of [['folien.html','Newsflash_Folien.pdf',{width:'297mm',height:'167mm'}],['sprechzettel.html','Newsflash_Sprechzettel.pdf',{format:'A4'}]]){
await p.goto('file://'+__dirname+'/'+f);await p.waitForTimeout(300);
await p.pdf({path:__dirname+'/'+o,printBackground:true,preferCSSPageSize:true,...opt});
await p.screenshot({path:'/tmp/claude-0/'+f+'.png',fullPage:true});}
await b.close();})();

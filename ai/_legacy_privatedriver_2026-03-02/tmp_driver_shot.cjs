const { chromium } = require('playwright');
const path = require('path');
const base='https://premium.private-driver.ro';
(async()=>{
  const res=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'test.driver@private-driver.ro',password:'Rares102018'})});
  const j=await res.json();
  const s={token:j.data.token,refreshToken:j.data.refresh_token,user:j.data.user};
  const browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:900},geolocation:{latitude:44.4268,longitude:26.1025},permissions:['geolocation']});
  const p=await ctx.newPage();
  await p.goto(base+'/login',{waitUntil:'domcontentloaded'});
  await p.evaluate((x)=>{localStorage.setItem('auth_token',x.token||'');localStorage.setItem('refresh_token',x.refreshToken||'');localStorage.setItem('user_data',JSON.stringify(x.user||{}));localStorage.setItem('userId',x.user?.id||x.user?._id||'');},s);
  await p.goto(base+'/v2/driver',{waitUntil:'domcontentloaded'});
  const b=p.locator('button:has-text("Accept toate")');
  if(await b.count()) await b.first().click().catch(()=>{});
  await p.waitForTimeout(12000);
  await p.screenshot({path:path.resolve('ai/screenshots/premium-driver-home-ready2.png'),fullPage:true});
  await browser.close();
})();

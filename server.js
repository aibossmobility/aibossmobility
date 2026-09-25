const http=require("http");
const fs=require("fs");
const path=require("path");
const root=path.join(__dirname,"public");
const port=process.env.PORT||3000;
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"application/javascript; charset=utf-8",".xml":"application/xml; charset=utf-8",".txt":"text/plain; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp"};
function resolveFile(url){
  const clean=decodeURIComponent((url||"/").split("?")[0]);
  const route=clean==="/"?"/index.html":clean;
  const target=path.extname(route)?route:route+".html";
  const file=path.normalize(path.join(root,target));
  return file.startsWith(root)?file:null;
}
http.createServer((req,res)=>{
  const file=resolveFile(req.url);
  if(!file){res.writeHead(400);return res.end("Bad request");}
  fs.readFile(file,(err,data)=>{
    if(!err){
      res.writeHead(200,{"Content-Type":mime[path.extname(file).toLowerCase()]||"application/octet-stream","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"});
      return res.end(data);
    }
    fs.readFile(path.join(root,"404.html"),(_,fallback)=>{
      res.writeHead(404,{"Content-Type":"text/html; charset=utf-8"});
      res.end(fallback||"Not found");
    });
  });
}).listen(port,"0.0.0.0",()=>console.log(`AI Boss Mobility listening on ${port}`));

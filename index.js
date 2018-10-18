const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 2333;
const ERR_MSG = 'Not Accepted, eg: /xss/str_literal?q=xss';

http.createServer((req, res) => {
  console.log(`[${new Date().toLocaleString()}] ${req.url}`);
  route(req, res);
}).listen(PORT, () => {
  console.log(`Listen At http://127.0.0.1:${PORT}`);
});


function route(req, res) {
  const url = req.url;
  let bypass = eval(`this.bypass = ${fs.readFileSync(path.join(__dirname, './bypass.config')).toString()}`);
  const m = /\/xss\/([^\?]+?)\?[\s\S]*q=([^&#$]*)/.exec(url);
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf8"
  });
  if (url === '/') {
    const ctt = Object.keys(bypass).map(type => {
      return `<li>
        <h3>${type}</h3>
        <ul>${bypass[type].map(c => {
          const mime = `${c.mime ? `mime=${c.mime}&` : ''}`;
          const q = c.hash ? `q=${c.inject}` : `q=${c.encode ? encodeURI(c.inject) : c.inject}${c.repeat ? `&repeat=${c.repeat||1}` : ''}`;
          return `<li><a href="/xss/${type}?${mime}${q}">${type}?q=${encodeURI(c.inject)}</a> ${c.repeat ? `(repeat: ${c.repeat})` : ""}</li>`;
        }).join("")}</ul>
      </li>`;
    });
    return res.end(`<style>a{  display: inline-block;max-width: 800px;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;vertical-align: middle;}</style><h2>XSS Filter Bypass</h2><ul>${ctt.join("")}</ul>`);
  } else if (url === '/favicon.ico') {
    return fs.createReadStream(path.join(__dirname, './resources/favicon.ico')).pipe(res);
  } else if (url.indexOf('/raw/') === 0) {
    return res.end(decodeURIComponent(url.split('/')[2]));
  } else if (url.indexOf('/resources/') === 0) {
    const mtype = /\.([\w\.\d]+)$/.test(url);
    const type = mtype && mtype[1];
    let ct = 'text/javascript';
    switch (type) {
      case 'html':
        ct = 'text/html';
        break;
      case 'css':
        ct = 'text/stylesheet';
        break;
      case 'png':
        ct = 'image/png';
        break;
      case 'jpg':
      case 'jpeg':
        ct = 'image/jpeg';
        break;
    }
    const filePath = path.join(__dirname, `.${url}`);
    if (!fs.existsSync(filePath)) {
      return res.end('File Not Found.');
    }
    res.writeHead(200, {
      "Content-Type": ct
    });
    return fs.createReadStream(filePath).pipe(res);
  } else if (m && m[1] && m[2] !== undefined) {
    const tplPath = path.join(__dirname, `./points/${m[1]}`);
    if (fs.existsSync(tplPath)) {
      let ctt = fs.readFileSync(tplPath).toString().replace(/\$\{POINT\}/g, decodeURIComponent(m[2]));
      const mr = /repeat=(\d+)/.exec(url);
      if (mr && mr[1]) {
        ctt = ctt.repeat(+mr[1]);
      }
      const mct = /mime=([^&#$]+)/.exec(url);
      if (mct && mct[1]) {
        res.writeHead(200, {
          "Content-Type": `text/${mct[1]}; charset=utf8`
        });
        return res.end(decodeURIComponent(ctt));
      }
      res.end(`<body>injection: <textarea style="width:400px;height:54px;vertical-align:middle;">${ctt}</textarea><br /><br /><hr /><br />\n\n${ctt}\n\n</body>`);
    } else {
      res.end(ERR_MSG);
    }
  } else {
    res.end(ERR_MSG);
  }
}
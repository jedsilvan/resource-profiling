// var http = require('http');
// http.createServer(function (req, res) {
//     res.writeHead(200, {'Content-Type': 'text/html'});
//     res.write("Current date and time: " + modules.fetchImage('https://dn-img-page.kakao.com/download/resource?kid=cSZvNP/hyATtZmAek/QlK4PcBrTSxbHzZKk6GFxk'));
//     res.end();
// }).listen(8080);



const modules  = require('./modules');
const imageUrl = [
    "https://dn-img-page.kakao.com/download/resource?kid=CCDwh/hyfMK8Bl85/kOyo9T8MtfielxoRvil9g1",
    "https://dn-img-page.kakao.com/download/resource?kid=i3VME/hyzTW11Sej/nqAnIwR444EEC1NXwAQrf1",
    "https://s.w-x.co/84impacts1.jpg"
];

for (i=0; i<3; i++) {
    modules.fetchImage(imageUrl[i])
        .then(function(response) {
            console.log(response)
        });
}
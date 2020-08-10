// var http = require('http');
// http.createServer(function (req, res) {
//     res.writeHead(200, {'Content-Type': 'text/html'});
//     res.write("Current date and time: " + modules.fetchImage('https://dn-img-page.kakao.com/download/resource?kid=cSZvNP/hyATtZmAek/QlK4PcBrTSxbHzZKk6GFxk'));
//     res.end();
// }).listen(8080);

// const modules  = require('./modules');
// const imageUrl = [
//     "https://dn-img-page.kakao.com/download/resource?kid=CCDwh/hyfMK8Bl85/kOyo9T8MtfielxoRvil9g1",
//     "https://dn-img-page.kakao.com/download/resource?kid=i3VME/hyzTW11Sej/nqAnIwR444EEC1NXwAQrf1",
//     "https://s.w-x.co/84impacts1.jpg"
// ];

// for (i=0; i<3; i++) {
//     modules.fetchImage(imageUrl[i])
//         .then(function(response) {
//             console.log(response)
//         });
// }



'use strict';

const puppeteer = require('puppeteer');
const chalk = require('chalk');
const cliProgress = require('cli-progress');

const bar = new cliProgress.SingleBar({
    format: chalk.cyanBright('Loading ') + '|' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} HTTP Requests',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});

const log = console.log;
const URL = 'http://localhost:3000/';
// const URL = 'https://mop-static.samsungfeed.com/base-template-dev/index.html';


(async function () {
    const imgCollection = [];
    let noOfFailedRequests = 0;
    let progressTotal = 0;

    function onDOMContentLoaded() {
        bar.start(progressTotal, 0);
    }

    function onRequest() {
        bar.setTotal(progressTotal++);
    }

    function onResponse(response) {
        bar.increment();
        const request = response._request;

        if (request._resourceType === "image") {
            imgCollection.push({
                url: request._url,
                contentLength: convertToKb(response._headers['content-length'])
            });
        }

        if (response._status !== 200) {
            noOfFailedRequests += 1;
        }
    }

    function convertToKb(contentLength) {
        if (!contentLength) return undefined;
        return (parseInt(contentLength) * 0.001).toFixed(1);
    }

    try {
        log(chalk.cyanBright('Launching puppeteer...'));
        const browser = await puppeteer.launch();
        const [page] = await browser.pages();
        page.setDefaultTimeout(0);
        page.on('domcontentloaded', onDOMContentLoaded);
        page.on('request', onRequest);
        page.on('response', onResponse);

        log(chalk.cyanBright('Accessing ') + chalk.green(URL));
        await page.goto(URL);
        // await page.waitForSelector('.card-preload-container', { hidden: true });


        log(`\n${noOfFailedRequests}/${progressTotal - 1} failed requests`);

        const imgDiv = await page.$$('[data-src]');


        // const properties = await listHandle.getProperties();
        log(await imgDiv[12]);
        // console.log(await page.content());
        // log(imgCollection);

        await browser.close();
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
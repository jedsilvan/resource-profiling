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



// 'use strict';

const puppeteer = require('puppeteer');
const chalk = require('chalk');
const cliProgress = require('cli-progress');

const bar = new cliProgress.SingleBar({
    format: chalk.cyanBright('Loading ') + '|' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} Image network requests',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});

const log = console.log;
const URL = 'http://localhost:3000/';
// const URL = 'https://mop-static.samsungfeed.com/base-template-dev/index.html';


(async function () {
    const imgResponse = [];
    const BODY_1 = "body1";
    const BODY_2 = "body2";
    let bodyAreaCollection = [];
    let expandedAreaCollection = [];
    let noOfFailedRequests = 0;
    let progressTotal = 0;

    function onDOMContentLoaded() {
        bar.start(progressTotal, 0);
    }

    function onRequest(request) {
        if (request._resourceType === "image") bar.setTotal(progressTotal++);
    }

    function onResponse(response) {
        bar.increment();
        const request = response._request;

        if (request._resourceType === "image") {
            imgResponse.push({
                src: request._url,
                contentLength: convertToKb(response._headers['content-length'])
            });

            if (response._status !== 200) {
                noOfFailedRequests += 1;
            }
        }
    }

    function convertToKb(contentLength) {
        if (!contentLength) return undefined;
        return (parseInt(contentLength) * 0.001).toFixed(1);
    }

    async function getImageFileSize(type, collection) {
        if (collection && collection.length) {
            collection.forEach((item, index) => {
                const img = imgResponse.find(i => i.src === item.src);
                if (!img) return;

                if (type === BODY_1) {
                    bodyAreaCollection[index].fileSize = img.contentLength;
                } else {
                    expandedAreaCollection[index].fileSize = img.contentLength;
                }
            });
        }
    }

    function combineBodyAreaAndExpandedAea({ body1, body2 }) {
        const groupedData = [];
        if (!body1) return groupedData;
        if (!body2) return body1;

        const cardIds = body1.map(i => i.cardId);
        const uniqueIds = [...new Set(cardIds)];

        uniqueIds.forEach(value => {
            const bodyArea = body1.filter(i => i.cardId === value);
            const expandedArea = body2.filter(i => i.cardId === value);
            groupedData.push({
                cardId: value,
                body1: bodyArea,
                body2: expandedArea
            })
        });

        return groupedData;
    }

    try {
        log(chalk.cyanBright('Launching chrome browser...'));
        const browser = await puppeteer.launch();
        const [page] = await browser.pages();
        page.setDefaultTimeout(0);
        page.on('domcontentloaded', onDOMContentLoaded);
        page.on('request', onRequest);
        page.on('response', onResponse);

        log(chalk.cyanBright('Accessing ') + chalk.green(URL));
        await page.goto(URL, { waitUntil: 'networkidle0' });
        await page.waitFor(() => !document.querySelector('.preload-container'));

        log(`\n${noOfFailedRequests}/${progressTotal - 1} failed requests`);

        // remove div#intro-card from the DOM
        await page.evaluate(() => {
            const el = document.querySelector('#intro-card');
            el.parentNode.removeChild(el);
        });

        bodyAreaCollection = await page.evaluate(() => Array.from(document.querySelectorAll('.bodyArea [data-src]'), element => {
            return {
                cardId: element.getAttribute('data-cardId'),
                fileSize: 0,
                height: element.getAttribute("data-height"),
                src: element.getAttribute('data-src'),
                templateId: element.getAttribute("data-body1"),
                width: element.getAttribute("data-width")
            }
        }));

        expandedAreaCollection = await page.evaluate(() => Array.from(document.querySelectorAll('.expandedArea [data-src]'), element => {
            return {
                cardId: element.getAttribute('data-cardId'),
                fileSize: 0,
                height: element.getAttribute("data-height"),
                src: element.getAttribute('data-src'),
                templateId: element.getAttribute("data-body2"),
                width: element.getAttribute("data-width")
            }
        }));

        await getImageFileSize(BODY_1, bodyAreaCollection);
        await getImageFileSize(BODY_2, expandedAreaCollection);
        const groupedData = combineBodyAreaAndExpandedAea({ body1: bodyAreaCollection, body2: expandedAreaCollection });

        // console.log("groupedData", groupedData);
        // console.log("==============================================================");
        // console.log("bodyAreaCollection", bodyAreaCollection);
        console.log("imgResponse", imgResponse);
        console.log("expandedAreaCollection", expandedAreaCollection);


        await browser.close();
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
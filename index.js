const puppeteer = require('puppeteer');
const chalk = require('chalk');
const cliProgress = require('cli-progress');
const fs = require('fs');

const bar = new cliProgress.SingleBar({
    format: chalk.cyanBright('Loading ') + '|' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} HTTP requests',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});

const multibar = new cliProgress.MultiBar({
    format: chalk.cyanBright('Validating {cardId} ') + '|' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} images',
    clearOnComplete: false,
    hideCursor: true
}, cliProgress.Presets.shades_grey);

const log = console.log;
const URL = 'http://localhost:3000/';
const rulesJSON = require('./rules');
const bodyAreaCollectionJSON = require('./bodyAreaCollection');
const expandedAreaCollectionJSON = require('./expandedAreaCollection');
const imgResponseJSON = require('./imgResponse');
// const URL = 'https://mop-static.samsungfeed.com/base-template-dev/index.html';


(async function () {
    const imgResponse = imgResponseJSON.imgResponse;
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
        // if (request._resourceType === "image") bar.setTotal(progressTotal++);
        bar.setTotal(progressTotal++);
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

    async function combineBodyAreaAndExpandedAea({ body1, body2 }) {
        const groupedData = [];
        if (!body1) return groupedData;
        if (!body2) return body1;

        const cardIds = body1.map(i => i.cardId);
        const uniqueIds = [...new Set(cardIds)];

        await uniqueIds.forEach(value => {
            const bodyArea = body1.filter(i => i.cardId === value);
            const expandedArea = body2.filter(i => i.cardId === value);
            groupedData.push({
                cardId: value,
                templateIdBody1: bodyArea.length ? bodyArea[0].templateId : null,
                templateIdBody2: expandedArea.length ? expandedArea[0].templateId : null,
                body1: bodyArea,
                body2: expandedArea
            })
        });

        return groupedData;
    }

    async function validateResources(data) {
        if (!data.length) return [];
        let result = [];

        const cardMultiBarArray = [];
        data.forEach(i => cardMultiBarArray.push(multibar.create((i.body1.length + i.body2.length), 0, { cardId: i.cardId })));

        data.forEach((item, index) => {
            const { cardId, templateIdBody1, templateIdBody2, body1, body2 } = item;

            let cardObj = new Object();
            cardObj.cardId = cardId;
            cardObj.totalResourceCount = (body1.length + body2.length);
            cardObj.profilingStatus = true;

            const rule = rulesJSON.rules.find(i => i.templateIds.includes(templateIdBody1));

            if (!templateIdBody1 || !rule) {
                cardObj.profilingStatus = false;
                cardObj.isValidResources = false;
                cardObj.error = [];
                if (!templateIdBody1) cardObj.error.push(`Template ID not defined in PartnerCard${cardId.substr(5)}.js`)
                if (!rule) cardObj.error.push(`Rules for ${cardId} not found`)
            } else if (body1.length) {
                cardObj.resourceStandards = {
                    bodyArea: {
                        fileSize: `up to ${rule.maxFileSize}kb`,
                        minResolution: `${rule.min.width}px X ${rule.min.height}px`,
                        maxResolution: `${rule.max.width}px X ${rule.max.height}px`,
                    },
                    expandedArea: {}
                }

                cardObj.bodyArea = {
                    template: "",
                    resources: []
                }

                body1.forEach(item => {
                    const { templateId, templateName, validation } = validateResource(item, rule);

                    cardObj.bodyArea.templateId = templateId;
                    cardObj.bodyArea.templateName = templateName;
                    cardObj.bodyArea.resources.push(validation);
                    // cardO
                    // result[index].bodyAreaResources.push(validation);
                    // result[index].bodyAreaTemplate = templateName;



                    // if (!templateId) {
                    //     result[index] = {
                    //         ...result[index],
                    //         error: `Template ID not defined in PartnerCard${cardId.substr(5)}.js`
                    //     };
                    //     delete result[index].bodyAreaTemplate;
                    //     delete result[index].bodyAreaResources;
                    // } else {
                    //     const { templateName, validation } = validateResource(item);
                    //     result[index].bodyAreaResources.push(validation);
                    //     result[index].bodyAreaTemplate = templateName;
                    // }
                    cardMultiBarArray[index].increment();
                });

                cardObj.bodyArea.resources
            }


            result.push(cardObj);

            // if (body2.length) {
            //     body2.forEach(item => {
            //         const { templateName, validation } = validateResource(item);
            //         result[index].expandedAreaResources.push(validation);
            //         result[index].expandedTemplate = templateName;

            //         cardMultiBarArray[index].increment();
            //     });
            // } else {
            //     delete result[index].expandedTemplate;
            //     delete result[index].expandedAreaResources;
            // }
        });


        return await result;
    }

    function validateResource(item, rule) {
        const { templateId, fileSize, src, width, height, cardId } = item;
        let templateName = "";

        const { name, min, max, maxFileSize } = rule;
        templateName = name;
        // partnerImageRequirement.push(`File size ${fileSizeValidator(fileSize, maxFileSize)} | Image file size: ${fileSize} kb | Max file size: up to ${maxFileSize} kb`);

        // if (!min || !max || !width || !height) {
        //     partnerImageRequirement.push('Image dimension not found');
        // } else {
        //     partnerImageRequirement.push(`Image dimension ${imageDimensionValidator({ min, max, width, height })} | Image dimension: ${width}x${height}px | Min resolution: ${min.width}x${min.height}px | Max resolution: ${max.width}x${max.height}px`);
        // }

        return {
            templateId,
            templateName,
            validation: {
                src,
                isValid: isFileSizeValid(fileSize, maxFileSize) && isResolutionValid({ min, max, width, height }),
                resourceDetails: {
                    fileSize: `${fileSize}kb`,
                    height: `${height}px`,
                    width: `${width}px`,
                }
            }
        }
    }

    function isFileSizeValid(imageFileSize, maxFileSize) {
        if (!imageFileSize || !maxFileSize) return false;
        return parseFloat(imageFileSize) < parseFloat(maxFileSize);
    }

    function isResolutionValid({ min, max, width, height }) {
        const _minWidth = parseInt(min.width);
        const _maxWidth = parseInt(max.width);
        const _minHeight = parseInt(min.height);
        const _maxHeight = parseInt(max.height);
        const _width = parseInt(width);
        const _height = parseInt(height);

        return ((_width >= _minWidth && _width <= _maxWidth) && (_height >= _minHeight && _height <= _maxHeight));
    }


    try {
        // log(chalk.cyanBright('Launching Headless Chrome browser...'));
        // const browser = await puppeteer.launch();
        // const [page] = await browser.pages();
        // page.setDefaultTimeout(0);
        // page.on('domcontentloaded', onDOMContentLoaded);
        // page.on('request', onRequest);
        // page.on('response', onResponse);

        // log(chalk.cyanBright('Accessing ') + chalk.green(URL));
        // await page.goto(URL, { waitUntil: 'networkidle0' });
        // await page.waitFor(() => !document.querySelector('.preload-container'));

        // log(`\n${noOfFailedRequests}/${progressTotal - 1} failed requests`);

        // // remove div#intro-card from the DOM
        // await page.evaluate(() => {
        //     const el = document.querySelector('#intro-card');
        //     el.parentNode.removeChild(el);
        // });

        // bodyAreaCollection = await page.evaluate(() => Array.from(document.querySelectorAll('.bodyArea [data-src]'), element => {
        //     return {
        //         cardId: element.getAttribute('data-cardId'),
        //         fileSize: 0,
        //         height: element.getAttribute("data-height"),
        //         src: element.getAttribute('data-src'),
        //         templateId: element.getAttribute("data-body1"),
        //         width: element.getAttribute("data-width")
        //     }
        // }));

        // expandedAreaCollection = await page.evaluate(() => Array.from(document.querySelectorAll('.expandedArea [data-src]'), element => {
        //     return {
        //         cardId: element.getAttribute('data-cardId'),
        //         fileSize: 0,
        //         height: element.getAttribute("data-height"),
        //         src: element.getAttribute('data-src'),
        //         templateId: element.getAttribute("data-body2"),
        //         width: element.getAttribute("data-width")
        //     }
        // }));

        bodyAreaCollection = bodyAreaCollectionJSON.bodyArea;
        expandedAreaCollection = expandedAreaCollectionJSON.expandedArea;

        await getImageFileSize(BODY_1, bodyAreaCollection);
        await getImageFileSize(BODY_2, expandedAreaCollection);
        const groupedData = await combineBodyAreaAndExpandedAea({ body1: bodyAreaCollection, body2: expandedAreaCollection });

        const result = await validateResources(groupedData);
        // console.log("groupedData", groupedData);
        // console.log("result", result);

        var jsonContent = JSON.stringify(result);

        fs.writeFileSync("result.json", jsonContent, 'utf8', function (err) {
            if (err) {
                console.log("An error occured while writing JSON Object to File.");
                return console.log(err);
            }

            console.log("JSON file has been saved.");
        });



        // await browser.close();
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
})();
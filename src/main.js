import { Actor } from "apify";
import { CheerioCrawler } from "crawlee";
import { router } from "./router.mjs";
import urls from "./urls.mjs";

await Actor.init();

const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ["RESIDENTIAL"],
    countryCode: "CZ",
});
 
// use dataset.drop()???  https://docs.apify.com/sdk/js/reference/class/Dataset
const crawler = new CheerioCrawler({
    // proxyConfiguration: proxyConfiguration,
    minConcurrency: 10,
    maxConcurrency: 100,

    maxRequestRetries: 3,

    requestHandlerTimeoutSecs: 60,
    requestHandler: router,
});
await crawler.run(urls.urls);

await Actor.exit();

import { createCheerioRouter } from "crawlee";
import urls from "./urls.mjs";

export const router = createCheerioRouter();

function afterLast(value, delimiter) {
    value = value || "";
    return delimiter === "" ? value : value.split(delimiter).pop();
}

for (const url of urls.urls) {
    const category = url.category;

    router.addHandler(
        `category-${category}`,
        async function ({ addRequests, request, sendRequest, log }) {
            const categoryPage = await fetch(request.url);
            const cookies = categoryPage.headers.getSetCookie();

            const categorySessionId = cookies
                .find((s) => s.includes("ASP.NET_SessionId"))
                .split("=")[1]
                .split(";")[0];

            await addRequests([
                {
                    url: `https://www.autokelly.cz/ProductList/Items/AllInOne/1`,
                    method: "POST",
                    label: `product-list-${category}`,
                    headers: {
                        "content-Type": "application/json",
                        accept: "application/json",
                        cookie: `ASP.NET_SessionId=${categorySessionId}`,
                        "content-length": 0,
                    },
                    uniqueKey: `product-list-${category}-1`,
                    userData: {
                        categoryKey: afterLast(request.url, "/"),
                    },
                },
            ]);
        }
    );

    router.addHandler(
        `product-list-${category}`,
        async function ({ json, request, pushData, addRequests, sendRequest }) {
            // console.log(json.Items?.length);
            if (json.Items) {
                for (const item of json.Items) {
                    await pushData(
                        { itemId: item.Id, ...item.Image, main: true },
                        "images"
                    );
                    for (const image of item.OtherImages) {
                        await pushData(
                            { itemId: item.Id, ...image, main: false },
                            "images"
                        );
                    }
                    await pushData(
                        { itemId: item.Id, ...item.Disponibility },
                        "disponibility"
                    );

                    delete item["Image"];
                    delete item["OtherImages"];
                    delete item["Disponibility"];
                    delete item["Attributes"];
                    delete item["TrackInfo"];
                    delete item["Description"];

                    const priceParts = item.PriceVat.split(" ");

                    await pushData(
                        {
                            ...item,
                            Price: priceParts[0].replace(/\s/g, ""),
                            Ccy: priceParts[1],
                            Category: category.replace(/[\-]/g, " "),
                            Timestamp: +new Date(),
                        },
                        "products"
                    );

                    const codeNoSpaces = item.Code.replace(/[\.\s]/g, "-");
                    const productDetailURL = `https://www.autokelly.cz/Product/${codeNoSpaces}/${item.Id}`;

                    const productDetail = await fetch(productDetailURL);
                    const cookies = productDetail.headers.getSetCookie();
                    const substSessionId = cookies
                        .find((s) => s.includes("ASP.NET_SessionId"))
                        .split("=")[1]
                        .split(";")[0];

                    // await addRequests([
                    //     {
                    //         url: `https://www.autokelly.cz/Product/Codes/${item.Id}`,
                    //         method: "POST",
                    //         label: `codes-${category}`,
                    //         headers: request.headers,
                    //         uniqueKey: `codes-${category}-${item.Id}`,
                    //         userData: {
                    //             itemId: item.Id,
                    //             categoryKey: request.userData.categoryKey,
                    //         },
                    //     },
                    //     {
                    //         url: `https://www.autokelly.cz/ProductList/Items/Substitutes/1`,
                    //         method: "POST",
                    //         label: `substitutes-${category}`,
                    //         headers: {
                    //             // "Content-Type": "application/json",
                    //             // accept: "application/json",
                    //             // "content-length": 0,
                    //             cookie: `ASP.NET_SessionId=${substSessionId}`,
                    //             referer: `https://www.autokelly.cz/Product/${codeNoSpaces}/${item.Id}?path=${request.userData.categoryKey}`,
                    //         },
                    //         uniqueKey: `substitutes-${category}-${item.Id}`,
                    //         userData: {
                    //             itemId: item.Id,
                    //             categoryKey: request.userData.categoryKey,
                    //         },
                    //     },
                    //     {
                    //         url: `https://www.autokelly.cz/Product/StoragesAll/${item.Id}`,
                    //         method: "POST",
                    //         label: `storages-${category}`,
                    //         headers: {
                    //             ...request.headers,
                    //             referer: `https://www.autokelly.cz/Product/${codeNoSpaces}/${item.Id}?path=${request.userData.categoryKey}`,
                    //         },
                    //         uniqueKey: `storages-${category}-${item.Id}`,
                    //         userData: {
                    //             itemId: item.Id,
                    //             categoryKey: request.userData.categoryKey,
                    //         },
                    //     },
                    // ]);
                }
                const pageNumber = json.Paging.Page + 1;

                await addRequests([
                    {
                        url: `https://www.autokelly.cz/ProductList/Items/AllInOne/${pageNumber}`,
                        method: "POST",
                        label: `product-list-${category}`,
                        headers: request.headers,
                        uniqueKey: `product-list-${category}-${pageNumber}`,
                        userData: {
                            categoryKey: request.userData.categoryKey,
                        },
                    },
                ]);
            }
        }
    );

    router.addHandler(
        `codes-${category}`,
        async function ({ json, pushData, request }) {
            await pushData(
                { ...json, id: request.userData.itemId },
                "codes-orig"
            );

            for (const oem of json.Oem) {
                for (const code of oem.Codes) {
                    await pushData(
                        {
                            itemId: request.userData.itemId,
                            manufacturer: oem.Manufacturer,
                            code: code,
                        },
                        "codes"
                    );
                }
            }
        }
    );

    router.addHandler(
        `substitutes-${category}`,
        async function ({ request, json, pushData }) {
            if (json.Items) {
                for (const item of json.Items) {
                    await pushData(
                        {
                            itemId: request.userData.itemId,
                            substituteId: item.Id,
                            substituteCode: item.Code,
                        },
                        "substitutes"
                    );
                }
            }
        }
    );
    router.addHandler(
        `storages-${category}`,
        async function ({ json, pushData, request }) {
            for (const storageInfo of json) {
                await pushData(
                    {
                        itemId: request.userData.itemId,
                        ...storageInfo,
                    },
                    "storages"
                );
            }
        }
    );
}

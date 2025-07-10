import puppeteer from "puppeteer-extra";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import { loadData } from "./utils.js";
import { printTable } from "console-table-printer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

let TOTAL_ITEMS_SCRAPERD = 0;
let TOTAL_PAGES_SCRAPERD = 0;
const scrapingResults = []; // Store detailed results for final summary
const executablePath =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function scrapeAll(BASE_URL, shop, catagoy) {
  let pagesScrapped = 0;
  let productCount = 0;
  let linkCount = 0;
  let status = "❌ Failed";

  try {
    puppeteer.use(StealthPlugin());
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
    });

    const page = await browser.newPage();

    let currentPage = 1;
    const allProducts = [];
    const individualProductLinks = [];
    while (true) {
      const url = `${BASE_URL}?page=${currentPage}`;
      TOTAL_PAGES_SCRAPERD++;
      pagesScrapped++;

      console.log(`🌐 Scraping page ${currentPage}: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2" });

      const products = await page.evaluate((shop) => {
        let GirdItemsSelector = "";
        let linkItemsSelector = "";
        let TitleSelector = "";
        let PriceSelector = "";
        let NewPriceSelector = "";
        let OldPriceSelector = "";
        let ImageSelector = "";

        if (shop === "StarTech") {
          GirdItemsSelector = ".p-item";
          linkItemsSelector = ".p-item-inner a";
          TitleSelector = ".p-item-name a";
          PriceSelector = ".p-item-price";
          NewPriceSelector = ".price-new";
          OldPriceSelector = ".price-old";
          ImageSelector = ".p-item-img a img";
        } else if (shop === "TechLandBD") {
          GirdItemsSelector = "article";
          linkItemsSelector = "h4 a";
          TitleSelector = "h4 a";
          PriceSelector = ".text-base.font-bold"; // Fallback if new/old not present
          NewPriceSelector = ".text-base.font-bold";
          OldPriceSelector = ".line-through";
          ImageSelector = ".image-box a img";
        } else if (shop === "Ryans") {
          GirdItemsSelector = ".category-single-product";
          linkItemsSelector = ".image-box a";
          TitleSelector = ".card-body .grid-view-text a";
          PriceSelector = ".card-body .cat-sp-text";
          NewPriceSelector = ".card-body .cat-sp-text";
          OldPriceSelector = ".card-body .cat-sp-text .line-through";
          ImageSelector = ".image-box a img";
        }

        return Array.from(document.querySelectorAll(GirdItemsSelector)).map(
          (el) => {
            console.log(el);
            const link = el.querySelector(linkItemsSelector)?.href || "";
            let title;
            if (shop === "Ryans") {
              // For Ryans, get the 'title' attribute from the anchor tag inside TitleSelector
              const titleAnchor = el.querySelector(TitleSelector);
              let rawTitle =
                titleAnchor?.getAttribute("data-bs-original-title")?.trim() ||
                titleAnchor?.textContent.trim() ||
                "";
              // Remove anything after <br>
              title = rawTitle.split("<br>")[0].trim();
            } else {
              title = el.querySelector(TitleSelector)?.textContent.trim() || "";
            }
            const image = el.querySelector(ImageSelector)?.src || "";

            const newPriceText =
              el
                .querySelector(NewPriceSelector)
                ?.textContent.trim()
                .replace(/[^0-9]/g, "") || "";
            const oldPriceText =
              el
                .querySelector(OldPriceSelector)
                ?.textContent.trim()
                .replace(/[^0-9]/g, "") || "";
            let priceText =
              el
                .querySelector(PriceSelector)
                ?.textContent.trim()
                .replace(/[^0-9]/g, "") || "";

            // If a specific new price is found, it should be the main price.
            // If the main price selector didn't find anything, use the new price as a fallback.
            if (newPriceText) {
              priceText = newPriceText;
            }

            return {
              link,
              title,
              price: priceText,
              newPrice: newPriceText,
              oldPrice: oldPriceText,
              image,
            };
          }
        );
      }, shop);

      products.forEach((product) => {
        const fixId = uuidv4();
        // Ensure to the producs
        product.id = fixId;
        product.shop = shop;
        product.category = catagoy;

        //inidividual Product Links
        if (product.link) {
          individualProductLinks.push({
            id: fixId,
            shop: shop,
            category: catagoy,
            link: product.link,
            name: product.title,
          });
        }
      });

      allProducts.push(...products);

      TOTAL_ITEMS_SCRAPERD += products.length;
      productCount += products.length;
      console.log(
        `✅ Scraped ${products.length} products from page ${currentPage}.`
      );

      // 🔁 Check if "NEXT" is available
      let hasNext = false;
      if (shop === "StarTech") {
        hasNext = await page.evaluate(() => {
          const pagination = document.querySelector(".pagination");
          if (!pagination) return false;

          const nextBtn = Array.from(pagination.querySelectorAll("li")).find(
            (li) => li.textContent.trim().toLowerCase() === "next"
          );
          return !!nextBtn?.querySelector("a");
        });
      } else if (shop === "TechLandBD") {
        const lastPage = await page.evaluate(() => {
          return Array.from(
            document.querySelectorAll('nav[aria-label="Pagination"] button')
          )
            .map((btn) => parseInt(btn.textContent.trim()))
            .filter(Number.isInteger)
            .reduce((max, num) => Math.max(max, num), 1);
        });

        hasNext = currentPage < lastPage;
      } else if (shop === "Ryans") {
        hasNext = await page.evaluate(() => {
          const pageLinks = document.querySelectorAll(
            "li.page-item .page-link"
          );
          const nextBtn =
            pageLinks.length > 0
              ? pageLinks[pageLinks.length - 1].parentElement
              : null;
          // If the button exists and does NOT have the 'disabled' class, there is a next page
          return nextBtn && !nextBtn.classList.contains("disabled");
        });
      }
      if (!hasNext) {
        console.log("🚫 No more pages. Scraping finished.");
        break;
      }

      currentPage++;
    }

    // ✅ Save results
    await fs.writeFile(
      `${shop + "_" + catagoy + "_"}products.json`,
      JSON.stringify(allProducts, null, 2)
    );
    await fs.writeFile(
      `${shop + "_" + catagoy + "_"}individualProductLinks.json`,
      JSON.stringify(individualProductLinks, null, 2)
    );

    productCount = allProducts.length;
    linkCount = individualProductLinks.length;
    status = "✅ Success";

    const localsummary = [
      { Metric: "Total products collected", Value: allProducts.length },
      {
        Metric: "Total individual links saved",
        Value: individualProductLinks.length,
      },
    ];

    printTable(localsummary);

    await browser.close();
  } catch (error) {
    console.error(`❌ Error scraping ${shop} - ${catagoy}:`, error);
    status = "❌ Failed";
  }

  // Store results for final summary
  scrapingResults.push({
    Shop: shop,
    Category: catagoy,
    Products: productCount,
    Pages: pagesScrapped,
    Links: linkCount,
    Status: status,
  });
}

async function startScraping() {
  try {
    const config = await loadData("config.json");
    if (!config || !Array.isArray(config)) {
      throw new Error("Config not found or is not a valid array.");
    }

    console.log("🔧 Loaded config:", config);

    for (const shop of config) {
      console.log(`🛒 Scraping shop: ${shop.shop}`);
      for (const category in shop.products) {
        const url = shop.products[category];
        console.log(`- Scraping category: ${category} : from ${url}`);
        console.log("shop", shop.shop);
        await scrapeAll(url, shop.shop, category);
      }
    }

    const summary = [
      { Metric: "Total items scraped", Value: TOTAL_ITEMS_SCRAPERD },
      { Metric: "Total pages scraped", Value: TOTAL_PAGES_SCRAPERD },
    ];
    printTable(summary);

    // 📊 FINAL SUMMARY
    console.log("\n" + "=".repeat(50));
    console.log("📊 FINAL SUMMARY");
    console.log("=".repeat(50));
    printTable(scrapingResults);
    console.log("=".repeat(50));
  } catch (err) {
    console.error("❌ Error during scraping:", err);
  }
}

startScraping();

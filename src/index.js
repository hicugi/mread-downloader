import puppeteer from "puppeteer";
import fs from "fs";

const url = "https://manhuaplus.com/manga/tales-of-demons-and-gods01/";
const IMAGE_START_WITH = "https://cdn.manhuaplus.com/";

const getPage = async (url, callback) => {
  const browser = await puppeteer.launch({ headless: false });

  const page = await browser.newPage();
  await page.setViewport({ width: 1, height: 1 });

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 0,
  });

  const data = await callback(page);
  await browser.close();

  return data;
};

const getImages = async (url, dirPath) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1, height: 1 });

  let counter = 0;
  page.on("response", async (response) => {
    const url = response.url();
    const matches = /.*\.(jpg|png|svg|gif)$/.exec(url);
    if (matches && matches.length === 2 && url.startsWith(IMAGE_START_WITH)) {
      const extension = matches[1];
      const buffer = await response.buffer();

      counter += 1;
      const filePath = `${dirPath}/${counter}.${extension}`;
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, buffer, "base64");
      }
    }
  });

  await page.goto(url, {
    waitUntil: "networkidle2",
    timeout: 0,
  });

  if (counter) {
    fs.writeFileSync(`${dirPath}/done`, counter);
  }
  await browser.close();
};

(async () => {
  const chapters = await getPage(url, async (page) => {
    return await page.evaluate(() =>
      Array.from(document.querySelectorAll(".wp-manga-chapter a[href]"), (a) =>
        a.getAttribute("href")
      )
    );
  });

  for (const chapter of chapters) {
    let dir = chapter.replace(/\/$/, "");
    dir = dir.substring(dir.lastIndexOf("/") + 1).replace("chapter-", "");
    const dirPath = `./export/${dir}`;

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
    if (fs.existsSync(`${dirPath}/done`)) {
      continue;
    }

    await getImages(chapter, dirPath);

    await new Promise((ok) => setTimeout(ok, 500));
  }
})();

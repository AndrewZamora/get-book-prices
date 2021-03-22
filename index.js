const Datastore = require('nedb');
const puppeteer = require('puppeteer');
const fs = require('fs');

const db = {
  meta: new Datastore('meta.db'),
  books: new Datastore('books.db')
};

const dbPromise = (db, action, ...args) => {
  return new Promise((resolve, reject) => {
    db[action](...args, (err, data) => {
      if (err) {
        return reject(err);
      }
      resolve(data);
    });
  });
};

const createFileName = str => {
  const noSpecialChar = str.replace(/[^a-zA-Z]/g, "");
  return noSpecialChar;
};

const getBookByTitleAndAuthor = async (title, author) => {
  const url = 'https://www.bookfinder.com/';
  const browser = await puppeteer.launch({ headless: true });
  let results;
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url);
    await page.focus('#author');
    await page.keyboard.type(author);
    await page.focus('#title');
    await page.keyboard.type(title);
    await page.click('#submitBtn');
    await page.waitForSelector('#bd > div.search-heading-box')
    const firstResultUrl = await page.evaluate(() => {
      return document.querySelector("ul.select-titlenames > li > span > a").href;
    });
    console.log(firstResultUrl)
    await page.goto(firstResultUrl);
    await page.waitForSelector("#bd > div.search-heading-box");
    const averagePrices = await page.evaluate(() => {
      const [newBooks, usedBooks] = document.querySelectorAll('#bd > table > tbody > tr td[align="left"][valign="top"]');
      // const usedBooksTr = Array.from(usedBooks.querySelectorAll("table > tbody > tr")).map(tr => tr.querySelectorAll("td:nth-child(4)");
      // return usedBooksTr
      const usedBooksTr = usedBooks.querySelectorAll("table > tbody > tr");
      let usedPrices = [];
      Array.from(usedBooksTr).forEach((node, index) => {
        if (index !== 0 && index !== usedBooksTr.length - 1) {
          usedPrices.push(node.children[3].textContent);
        }
      });
      return usedPrices
    });
    console.log(averagePrices)
    // console.log(first)
    // await page.screenshot({ path: `./screenshots/${createFileName(title)}-${createFileName(author)}.png`, fullPage: true });
    await browser.close();
  } catch (err) {
    console.log(err)
    await browser.close();
  }
};

Object.keys(db).forEach(collection => db[collection].loadDatabase());

(async () => {
  const dbQuery = limit => {
    return new Promise((resolve, reject) => {
      db
        .books
        .find({ $where: function () { return this.author.split(" ").length === 2 } })
        .sort({ title: 1 })
        .skip(0).limit(limit).exec((err, docs) => {
          if (err) {
            reject(err);
          }
          resolve(docs);
        });
    });
  }
  const docs = await dbQuery(1).catch(err => console.log(err));
  let promises = [];
  docs.forEach(doc => {
    promises.push(getBookByTitleAndAuthor(doc.title, doc.author));
  });
  Promise.all(promises).catch(err => console.log((err)));
  // await getBookByTitleAndAuthor(doc.title, doc.author).catch(err => console.log);
})();

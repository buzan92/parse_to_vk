import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import C from './constants';

const getPage = async (url) => {
  let result = null;
  await axios.get(url)
    .then((res) => {
      result = res.data;
    }).catch((err) => {
      console.log(`getPageError ${url}`, err);
    });
  return result;
};

const getGoodsLinks = async (url) => {
  const catalogPage = await getPage(url);
  const $ = cheerio.load(catalogPage);
  const goods = [];
  $('.catalog__item_link_all').each(function each() {
    const a = $(this).attr('href');
    goods.push(C.parseURL + a.trim());
  });
  return goods;
};

async function downloadImage(url) {
  const filename = url.split('/').pop();
  const dir = path.resolve(__dirname, 'images', filename);
  const response = await axios({
    method: 'GET',
    url, // url: url
    responseType: 'stream',
  });

  response.data.pipe(fs.createWriteStream(dir));

  return new Promise((resolve, reject) => {
    response.data.on('end', () => {
      resolve(filename);
    });
    response.data.on('error', () => {
      reject();
    });
  });
}

export const getGood = async (url) => {
  const goodPage = await getPage(url);
  const $ = cheerio.load(goodPage);
  let name = $('.product-card-menu__title').first().text();
  while (name.length < 4) { name = `${name}_`; }

  const priceStr = $('.product-card-section-description__price').first().text();
  const price = priceStr.replace(/\D/g, '');

  const imagesArr = [];
  $('.product-card-section-slider__item > img').each(function each(idx) { // idx check ??
    if (idx > 5) return false;
    const img = $(this).attr('src');
    if (img) {
      imagesArr.push(C.parseURL + img.trim());
    }
    return true; // ?
  });

  const images = await imagesArr.reduce(async (accum, img) => {
    const imageNames = await accum;
    const downloaded = await downloadImage(img);
    imageNames.push(downloaded);
    return imageNames;
  }, Promise.resolve([]));

  let description = '';
  $('#description p').each(function each() {
    const p = $(this).text();
    if (p) {
      description += `${p.trim()}\n`;
    }
  });

  let characteristics = '';
  $('.product-card-char__item').each(function each() {
    const char = $(this).text();
    if (char) {
      characteristics += `${char.trim()}\n`;
    }
  });
  description += characteristics;
  if (description === '') {
    description = $('.product-card-section-description__p').first().text();
  }
  return {
    name,
    price,
    description,
    images,
  };
};

export const getGoods = async (url) => {
  const start = await getPage(url);
  const $ = cheerio.load(start);
  const menu = [];
  $('li.submenu-top__item > a').each(function each() {
    const item = {};
    item.a = C.parseURL + $(this).attr('href').trim();
    item.category = $(this).find('h4').text();
    menu.push(item);
  });

  const goodsLinks = await menu.reduce(async (goodsArr, item) => {
    const goods = await goodsArr;
    const links = await getGoodsLinks(item.a);
    goods.push({
      category: item.category,
      links,
    });
    return goods;
  }, Promise.resolve([]));
  return goodsLinks;
};

import Koa from 'koa';
import KoaRouter from 'koa-router';
import koaBody from 'koa-body';
import c from './constants';
import * as crawler from './crawler';
import * as vk from './vk';

let token = null;

const app = new Koa();
const router = new KoaRouter();

async function showVkAuthLink(ctx) {
  ctx.body = `<a href='${vk.authUrl}'>Auth</a>`;
}

async function auth(ctx) {
  const { code } = ctx.request.query;
  if (code) {
    token = await vk.getAccessToken(code);
  }
  ctx.body = token ? `token: ${token} ` : 'Unsuccessful query, check constants';
}

async function mAddMarket(link, albumId) {
  const good = await crawler.getGood(link);
  const itemId = await vk.addMarket(token, good);
  const success = await vk.addToAlbum(token, itemId, albumId);
  console.log(`link: ${link}, success: ${success}`);
}


async function parse() {
  console.log('parse started!');
  // token = '';

  const goods = await crawler.getGoods(c.parseURL);
  
  for await (const categoryObj of goods) {
    const { category, links } = categoryObj;
    console.log(`category: ${category}, links.length: ${links.length}`);
    const albumId = await vk.addAlbum(token, category);
    let i = 0;
    for await (const link of links) {
      const good = await crawler.getGood(link);
      const itemId = await vk.addMarket(token, good);
      const success = await vk.addToAlbum(token, itemId, albumId);
      console.log(`link: ${link}, success: ${success}`);
    }
  }

  /*
  await goods.reduce(async (categoryPromise, categoryObj) => {
    await categoryPromise;
    const { category, links } = categoryObj;
    console.log(`category: ${category}, links.length: ${links.length}`);
    const albumId = await vk.addAlbum(token, category);

    await Promise.all(links.map(async (link) => {
      // await mAddMarket(link, albumId);
      
      const good = await crawler.getGood(link);
      const itemId = await vk.addMarket(token, good);
      const success = await vk.addToAlbum(token, itemId, albumId);
      console.log(`link: ${link}, success: ${success}`);
      
    }));

    
    await links.reduce(async (linkPromise, link) => {
      await linkPromise;
      const good = await crawler.getGood(link);
      console.log(`name: ${good.name}`);
      // const itemId = await vk.addMarket(token, good);
      // const success = await vk.addToAlbum(token, itemId, albumId);
      // console.log(`link: ${link}, success: ${success}`);
    }, Promise.resolve());
    
  }, Promise.resolve());
  */
  
  /*
  const parser = await goods.reduce(async (categoryStatuses, category) => {
    const categoryStatus = await categoryStatuses;
    const categoryName = category.category;
    console.log(`category: ${categoryName}`);
    const goodLinks = category.links;
    const albumId = await vk.addAlbum(token, categoryName);

    const statuses = await goodLinks.reduce(async (linkStatus, link) => {
      const status = await linkStatus;
      const good = await crawler.getGood(link);
      const itemId = await vk.addMarket(token, good);
      const success = await vk.addToAlbum(token, itemId, albumId);
      console.log(`link: ${link}, success: ${success}`);
      status.push({ link, success });
      return status;
    }, Promise.resolve([]));

    // console.log('statuses: ', statuses);
    categoryStatus.push({ categoryName, statuses });
    return categoryStatus;
  }, Promise.resolve([]));
  */
  console.log('Job done! =)');
  // ctx.status = 200;
  // ctx.body = 'Parsing...';
}

router
  .get('/', showVkAuthLink)
  .get('/auth', auth)
  .get('/parse', parse);

app
  .use(koaBody())
  .use(router.routes())
  .use(router.allowedMethods());

app.listen(c.port);
parse();
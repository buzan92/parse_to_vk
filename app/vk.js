import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import querystring from 'querystring';
import C from './constants';

export const authUrl = `${C.authDialogURL}
?client_id=${C.vkClientId}
&redirect_uri
&display=page
&redirect_uri=${C.vkRedirectUri}
&scope=${C.vkScope}
&response_type=code
&v=${C.vkApiVersion}`;


export const getAccessToken = async (code) => {
  let token = null;
  if (!code) return null;
  await axios.get(C.accessTokenURL, {
    params: {
      client_id: C.vkClientId,
      client_secret: C.vkClientSecret,
      redirect_uri: C.vkRedirectUri,
      code, // code: code,
    },
  })
    .then((res) => {
      if (res.data.access_token) {
        token = res.data.access_token;
      }
    }).catch((err) => {
      console.log('getTokenError', err);
    });
  return token;
};

const getMarketUploadServer = async (token, mainPhoto = 0) => {
  let marketUploadServer = null;
  await axios.get('https://api.vk.com/method/photos.getMarketUploadServer', {
    params: {
      main_photo: mainPhoto,
      access_token: token,
      group_id: C.vkGroupId,
      v: C.vkApiVersion,
    },
  })
    .then((res) => {
      marketUploadServer = res.data.response.upload_url ? res.data.response.upload_url : null;
    }).catch((err) => {
      console.log('getMarketUploadServer', err);
    });
  return marketUploadServer;
};

const saveMarketPhoto = async (token, imageData) => {
  const result = await axios.get('https://api.vk.com/method/photos.saveMarketPhoto', {
    params: {
      group_id: C.vkGroupId,
      photo: imageData.photo,
      server: imageData.server,
      hash: imageData.hash,
      crop_data: imageData.crop_data,
      crop_hash: imageData.crop_hash,
      access_token: token,
      v: C.vkApiVersion,
    },
  }).catch((err) => {
    console.log('Error while save album photo: ', err);
  });
  return result.data;
};

const getMarketAlbumUploadServer = async (token) => {
  let marketAlbumUploadServer = null;
  await axios.get('https://api.vk.com/method/photos.getMarketAlbumUploadServer', {
    params: {
      access_token: token,
      group_id: C.vkGroupId,
      v: C.vkApiVersion,
    },
  })
    .then((res) => {
      marketAlbumUploadServer = res.data.response.upload_url ? res.data.response.upload_url : null;
    }).catch((err) => {
      console.log('getMarketUploadServer', err);
    });
  return marketAlbumUploadServer;
};

const uploadPhoto = async (url, image) => {
  let imageData = null;
  const formData = new FormData();
  formData.append('file', fs.createReadStream(path.join(__dirname, '/images/', image)), image); // resolve
  await axios.post(url, formData, { headers: formData.getHeaders() })
    .then((res) => {
      imageData = res.data ? res.data : null;
    }).catch((err) => {
      console.log('uploadPhoto err', err);
    });
  return imageData;
};

const saveAlbumPhoto = async (token, imageData) => {
  const result = await axios.get('https://api.vk.com/method/photos.saveMarketAlbumPhoto', {
    params: {
      group_id: C.vkGroupId,
      photo: imageData.photo,
      server: imageData.server,
      hash: imageData.hash,
      access_token: token,
      v: C.vkApiVersion,
    },
  }).catch((err) => {
    console.log('Error while save album photo: ', err);
  });
  return result.data;
};


export const addAlbum = async (token, albumTitle) => {
  const uploadServer = await getMarketAlbumUploadServer(token);
  // const albumImage = path.join(__dirname, '/images/album.jpg');
  const imageData = await uploadPhoto(uploadServer, 'album.jpg');
  const isSaved = await saveAlbumPhoto(token, imageData);
  const albumPhotoId = isSaved.response[0].id;
  const albumId = await axios.get('https://api.vk.com/method/market.addAlbum', {
    params: {
      access_token: token,
      owner_id: -C.vkGroupId,
      title: albumTitle,
      photo_id: albumPhotoId,
      main_album: 0,
      v: C.vkApiVersion,
    },
  }).catch((err) => { console.log('Error while create new album: ', err); });

  return albumId.data.response.market_album_id;
};

export const addMarket = async (token, good) => {
  const mainUploadServer = await getMarketUploadServer(token, 1);
  const mainImageData = await uploadPhoto(mainUploadServer, good.images.shift()); // good.images[0]
  console.log('isMainSaved:', mainImageData);
  const isMainSaved = await saveMarketPhoto(token, mainImageData);
  const mainPhotoId = isMainSaved.response[0].id;

  const uploadServer = await getMarketUploadServer(token);
  const photoIds = await good.images.reduce(async (ids, image) => {
    const idsPromise = await ids;
    const imageData = await uploadPhoto(uploadServer, image);
    const photoId = await saveMarketPhoto(token, imageData);
    idsPromise.push(photoId.response[0].id);
    return idsPromise;
  }, Promise.resolve([])); // promise resolve ??
  const marketid = await axios.post('https://api.vk.com/method/market.add', querystring.stringify({
    access_token: token,
    owner_id: -C.vkGroupId,
    name: good.name,
    description: good.description,
    category_id: C.categoryId,
    price: good.price,
    deleted: 0,
    main_photo_id: mainPhotoId,
    photo_ids: photoIds.join(','),
    v: C.vkApiVersion,
  })).catch((err) => { console.log('Error while create new market: ', err); });
  if (marketid.data.response && marketid.data.response.market_item_id) {
    return marketid.data.response.market_item_id;
  }
  console.log('addMarket data: ', marketid.data);
  return null;
};

export const addToAlbum = async (token, itemId, albumId) => {
  const success = await axios.post(
    'https://api.vk.com/method/market.addToAlbum',
    querystring.stringify({
      access_token: token,
      owner_id: -C.vkGroupId,
      item_id: itemId,
      album_ids: albumId,
      v: C.vkApiVersion,
    }),
  ).catch((err) => { console.log('Error while add market to album: ', err); });
  return success.data.response;
};

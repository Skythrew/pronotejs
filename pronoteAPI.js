const axios = require('axios');
const crypto = require('crypto');
const zlib = require('zlib');
const { JSDOM } = require('jsdom');
const { promisify } = require('util');

const MD5 = require('crypto-js/md5');
const { AES, enc } = require('crypto-js');
const { RSAKey } = require('cryptico');

const sleep = promisify(setTimeout);

class Communication {
  constructor(site, cookies, client) {
    this.rootSite = this.getRootAddress(site);
    this.htmlPage = this.getHtmlPage(site);
    this.session = axios.create({
      baseURL: `${this.rootSite}/${this.htmlPage}`,
      headers: {
        'Connection': 'keep-alive',
        'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:73.0) Gecko/20100101 Firefox/73.0',
      },
      cookies: cookies,
    });
    this.encryption = new Encryption();
    this.attributes = {};
    this.requestNumber = 1;
    this.cookies = cookies;
    this.lastPing = 0;
    this.authorizedOnglets = [];
    this.client = client;
    this.compressRequests = false;
    this.encryptRequests = false;
    this.lastResponse = null;
  }

  async initialise() {
    const headers = {
      'connection': 'keep-alive',
      'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:73.0) Gecko/20100101 Firefox/73.0',
    };

    let getResponse;
    for (let i = 0; i < 3; i++) {
      try {
        console.log(`Requesting html: ${this.rootSite}/${this.htmlPage}`);
        getResponse = await this.session.get('', { headers: headers });
        console.log('[Communication.initialise] html received');
        this.attributes = this.parseHtml(getResponse.data);
      } catch (err) {
        console.warn('[Communication.initialise] Failed to parse html, retrying...');
        continue;
      }
      break;
    }

    if (!this.attributes['h']) {
      throw new Error('Unable to connect to pronote, please try again later');
    }

    const uuid = Buffer.from(this.rootSite.startsWith('https') ? this.encryption.aesIvTemp : this.encryption.rsaEncrypt(this.encryption.aesIvTemp)).toString('base64');
    const jsonPost = { Uuid: uuid, identifiantNav: null };
    this.encryptRequests = !this.attributes['sCrA'];
    this.compressRequests = !this.attributes['sCoA'];

    const initialResponse = await this.post('FonctionParametres', { donnees: jsonPost }, { iv: MD5(this.encryption.aesIvTemp).toString() });
    return [this.attributes, initialResponse];
  }

  async post(functionName, data, decryptionChange = null) {
    if (data['_Signature_'] && !this.authorizedOnglets.includes(data['_Signature_'].onglet)) {
      throw new Error('Action not permitted. (onglet is not normally accessible)');
    }

    let postdata = data;

    if (this.compressRequests) {
      console.log('[Communication.post] compressing data');
      const postdataHex = Buffer.from(JSON.stringify(data)).toString('hex');
      postdata = (await promisify(zlib.deflate)(Buffer.from(postdataHex, 'hex'), { level: 6 })).toString('hex').toUpperCase();
    }

    if (this.encryptRequests) {
      console.log('[Communication.post] encrypt data');
      if (typeof postdata === 'object') {
        postdata = AES.encrypt(JSON.stringify(postdata), this.encryption.aesKey).toString().toUpperCase();
      } else if (typeof postdata === 'string') {
        postdata = AES.encrypt(Buffer.from(postdata, 'hex'), this.encryption.aesKey).toString().toUpperCase();
      }
    }

    const rNumber = AES.encrypt(this.requestNumber.toString(), this.encryption.aesKey).toString();
    const json = {
      session: parseInt(this.attributes.h),
      numeroOrdre: rNumber,
      nom: functionName,
      donneesSec: postdata,
    };
    console.log('[Communication.post] sending post request:', json);

    const pSite = `${this.rootSite}/appelfonction/${this.attributes.a}/${this.attributes.h}/${rNumber}`;

    const response = await this.session.post(pSite, json);
    this.requestNumber += 2;
    this.lastPing = Math.floor(Date.now() / 1000);
    this.lastResponse = response;

    if (!response.data) {
      throw new Error(`Status code: ${response.status}`);
    }
    if (response.data.Erreur) {
      const errorMessages = {
        22: '[ERROR 22] The object was from a previous session. Please read the "Long Term Usage" section in README on github.',
        10: '[ERROR 10] Session has expired and pronotepy was not able to reinitialise the connection.',
        25: '[ERROR 25] Exceeded max authorization requests. Please wait before retrying...',
      };
      const errorMessage = errorMessages[response.data.Erreur.G] || `Unknown error from pronote: ${response.data.Erreur.G} | ${response.data.Erreur.Titre}`;
      throw new Error(errorMessage);
    }

    if (decryptionChange) {
      console.log('[Communication.post] decryption change');
      if (decryptionChange.iv) {
        this.encryption.aesIv = decryptionChange.iv;
      }
      if (decryptionChange.key) {
        this.encryption.aesKey = decryptionChange.key;
      }
    }

    let responseData = response.data;

    if (this.encryptRequests) {
      console.log('[Communication.post] decrypting');
      const decrypted = AES.decrypt(Buffer.from(responseData.donneesSec, 'hex'), this.encryption.aesKey).toString(enc.Utf8);
      responseData.donneesSec = !this.compressRequests ? JSON.parse(decrypted) : Buffer.from(decrypted, 'hex');
    }

    if (this.compressRequests) {
      console.log('[Communication.post] decompressing');
      try {
        responseData.donneesSec = JSON.parse((await promisify(zlib.inflate)(Buffer.from(responseData.donneesSec, 'hex'), { windowBits: -15 })).toString());
      } catch (err) {
        throw new Error('JSONDecodeError while requesting from pronote.');
      }
    }

    return responseData;
  }

  async afterAuth(data, authKey) {
    this.encryption.aesKey = authKey;
    if (!this.cookies) {
      this.cookies = this.lastResponse.headers['set-cookie'];
    }
    const work = this.encryption.aesDecrypt(Buffer.from(data.donnees.cle, 'hex')).toString(enc.Utf8);
    const key = MD5(work);
    this.encryption.aesKey = key;
  }

  parseHtml(html) {
    const dom = new JSDOM(html);
    const onload = dom.window.document.querySelector('#id_body');
    if (onload) {
      const match = onload.getAttribute('onload').match(/Start ?\({(.*)}\)/);
      if (!match) {
        throw new Error('Page html is different than expected. Be sure that pronote_url is the direct url to your pronote page.');
      }
      const onloadC = match[1];
      const attributes = {};
      onloadC.split(',').forEach(attr => {
        const [key, value] = attr.split(':');
        attributes[key] = value.replace(/'/g, '');
      });
      return attributes;
    } else if (html.includes('IP')) {
      throw new Error('Your IP address is suspended.');
    } else {
      throw new Error('Page html is different than expected. Be sure that pronote_url is the direct url to your pronote page.');
    }
  }

  getRootAddress(addr) {
    const parts = addr.split('/');
    return parts.slice(0, -1).join('/');
  }

  getHtmlPage(addr) {
    const parts = addr.split('/');
    return parts.slice(-1)[0];
  }
}

class Encryption {
  constructor() {
    this.aesIv = Buffer.alloc(16);
    this.aesIvTemp = crypto.randomBytes(16);
    this.aesKey = MD5().toString();
  }

  aesEncrypt(data) {
    const cipher = AES.encrypt(data, this.aesKey, { iv: this.aesIv });
    return Buffer.from(cipher.toString(), 'hex');
  }

  aesDecrypt(data) {
    const cipher = AES.decrypt(data.toString('hex'), this.aesKey, { iv: this.aesIv });
    return Buffer.from(cipher.toString(enc.Utf8));
  }

  aesSetIv(iv = null) {
    this.aesIv = iv || MD5(this.aesIvTemp).toString();
  }

  aesSetKey(key = null) {
    if (key) {
      this.aesKey = MD5(key).toString();
    }
  }

  rsaEncrypt(data) {
    const rsaKey = new RSAKey();
    rsaKey.setPublic(this.RSA_1024_MODULO, this.RSA_1024_EXPONENT);
    const encrypted = RSAKey.encrypt(data, rsaKey);
    return Buffer.from(encrypted, 'hex');
  }
}

class KeepAlive {
  constructor(client) {
    this.client = client;
    this.keepAlive = true;
  }

  async alive() {
    while (this.keepAlive) {
      if (Math.floor(Date.now() / 1000) - this.client.communication.lastPing >= 110) {
        await this.client.post('Presence', 7);
      }
      await sleep(1000);
    }
  }

  start() {
    this.alive();
  }

  stop() {
    this.keepAlive = false;
  }
}

module.exports = { Communication, Encryption, KeepAlive };

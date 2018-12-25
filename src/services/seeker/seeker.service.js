// Initializes the `Seeker` service on path `/seeker`
const Request = require('request');
const hooks = require('./seeker.hooks');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const { parse } = require('node-html-parser');

const config = require('./seeker.json');
const { client_imgur, url_imgur} = require('./thirdparty.json');

const URL_SERTIFIKAT = 'https://sertifikatfasilkom.web.id/sn2018/seminar1-1';
const URL_CETAK_SERTIFIKAT = 'https://sertifikatfasilkom.web.id/sn2018/cetak/cert_seminar1';

const searchNameIfExist = function (name_args) {

  let R = null;
  const P = new Promise((r) => R = r);

  /* search user from e-sertifikat */
  const url_esertifikat = (this.URL_SERTIFIKAT) ? this.URL_SERTIFIKAT:URL_SERTIFIKAT;
  const parsedUrl = url.parse(url_esertifikat, true);
  const postData = querystring.stringify({
    'id': name_args,
    'certificate': 'Cek'
  });

  const req = http.request({
    host: parsedUrl.hostname,
    path: parsedUrl.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, function (res) {
    // Continuously update stream with data
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
      const bodyAlreadyLowercase = body.toLocaleLowerCase();
      const isExist = (new RegExp(name_args)).test(bodyAlreadyLowercase);
			
      console.warn('name_args', name_args);
      console.warn('this.url', url_esertifikat);
      console.warn('isExist', isExist);			
			
      let name = '';
      let kodecetak = '';
      if(isExist) {
        // convert string to dom
        const root = parse(body);
        // query dom and get the name
        const dom = root.querySelectorAll('input');
        if(dom.length > 1) {
          dom.map(item => {
            const attr = item.attributes['name'];
            if(attr == 'namacetak') {
              name = item.attributes['value'];		
              return true;
            }
            if(attr == 'kodecetak') {
              kodecetak = item.attributes['value'];
              return true;
            }
            return false;
          });
        }
      }
      R({
        name,
        kodecetak,
        isExist
      });
    });
  });

  req.write(postData);
  req.end();

  return P;

};

const generateSearchNameIfExist = (url) => {
  return searchNameIfExist.bind({URL_SERTIFIKAT: url});
};

const uploadImageToImgur = async ({base64, name}) => {

  let R = null;
  const P = new Promise((r) => R = r);

  const clientid = client_imgur;
  const uri = url_imgur;
  const formData = {
    'image': base64,
    'title': name,
  };

  /* upload file to imgur */
  const request = Request.defaults({encoding: 'utf8'});
  request.post({
    url: uri,
    formData: formData,
    headers: {
      'Authorization': 'Client-ID '+ clientid
    }
  }, (err, response, body) => {
    if (err) {
      console.error('upload failed', err);
      return R({
        body,
        err
      });
    }
    console.warn('Upload successful!  Server responded');
    try {
      const data = JSON.parse(body);
      R({
        ...data,
      });
    }
    catch (err) {
      R({
        err
      });
    }
  });

  return P;
};

const getImageSertifikat = function (name, kodecetak) {

  let R = null;
  const P = new Promise((r) => R = r);

  /* cetak user e-sertifikat */
  console.warn('pakai this ', this.URL_CETAK_SERTIFIKAT);
  const uri = (this.URL_CETAK_SERTIFIKAT)? this.URL_CETAK_SERTIFIKAT: URL_CETAK_SERTIFIKAT;
  console.warn(uri);
  const request = Request.defaults({encoding: null});
  request.post({
    url: uri,
    form: {
      'namacetak': name,
      'kodecetak': kodecetak
    }
  }, async (error, response, body) => {
    if (!error && response.statusCode == 200) {
      let base64 = new Buffer(body).toString('base64');
      const filename = name + '_' + kodecetak + '.jpeg';
      const imgur = await uploadImageToImgur({
        base64,
        name: filename
      });
      R({
        ...imgur
      });
    }
  });
	
  return P;
	
};

const generateGetImageSertifikat = (url) => {
  console.warn('bind ', url);
  return getImageSertifikat.bind({URL_CETAK_SERTIFIKAT: url});
};

class Seeker {
  async find(params) {

    // Return an object in the form of { name, text }
		
    let {
      query: {
        name
      }
    } = params;
		
    name = name.toLocaleLowerCase();

    const _output = Promise.all(config.map(async ({ URL_CETAK_SERTIFIKAT, URL_SERTIFIKAT, JUDUL }) => {
      const searchNameIfExist = generateSearchNameIfExist(URL_SERTIFIKAT);
      const {
        isExist,
        name: _name,
        kodecetak,
      } = await searchNameIfExist(name);

      if (!isExist)
        return {
          isExist,
          params,
          success: false
        };

      let output = null;

      try {
        const getImageSertifikat = generateGetImageSertifikat(URL_CETAK_SERTIFIKAT);
        output = await getImageSertifikat(_name, kodecetak);
      } catch (error) {
        console.error(error);
      }

      return {
        isExist,
        ...output,
        judul: JUDUL
      };

    }));

    return _output.then(data => {
      return {
        message: 'response from server',
        data
      };
    }); 

  }
}

module.exports = function (app) {

  // Initialize our service with any options it requires
  app.use('/seeker', new Seeker());

  // Get our initialized service so that we can register hooks
  const service = app.service('seeker');

  service.hooks(hooks);
};

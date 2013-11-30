function ImageService(domain, options) {
  this.domain = domain;
  if(typeof options.thumb == 'function') {
    this.thumbFunc = options.thumb;
  } else {
    this.thumbUrl = options.thumb;
  }

  if(options.upload) {
    this.uploadOptions = $.extend(true, {}, ImageService.defaultUploadOptions, options.upload);
  }

  this.getThumb = function(url) {
    var urlMatch = url.match(/(https?:\/\/|www\.)(.*?)\/(.*)$/i);
    var domain = urlMatch[2];
    var path = urlMatch[3];
    if(this.domain == domain) {
      if(this.thumbFunc) {
        return this.thumbFunc(path, url);
      }
      return this.thumbUrl.replace('$1', path).replace('$2', url);
    }
    return null;
  };

  this.hasUpload = function() {
    return !!this.uploadOptions;
  };

  this.upload = function(file, onFinish, onProgress) {
    var xhr = new XMLHttpRequest();
    xhr.open('post', this.uploadOptions.url, true);

    var _this = this;
    xhr.onreadystatechange = function() {
      if (this.readyState != 4) {
        return;
      }
      if(xhr.status == 200 && xhr.responseText) {
        var parsedResponse = null;
        if(_this.uploadOptions.dataType == 'json') {
          try {
            parsedResponse = JSON.parse(xhr.responseText);
          } catch(e) {}
        } else if(_this.uploadOptions.dataType == 'xml') {
          try {
            parsedResponse = $(xhr.responseText);
          } catch(e) {}
        }
        if(parsedResponse) {
          onFinish(true, _this.uploadOptions.parseSuccess(parsedResponse, xhr));
          return;
        }
      }
      onFinish(false, _this.uploadOptions.parseError(xhr));
    };

    TweetManager.instance.twitterBackend.signOauthEcho(xhr, this.uploadOptions.signingUrl);

    var formData = new FormData();
    for(var param in this.uploadOptions.params) {
      var paramValue = this.uploadOptions.params[param];
      if(paramValue == '$file') {
        paramValue = file;
      }
      formData.append(param, paramValue);
    }

    if(onProgress) {
      xhr.upload.addEventListener("progress", function(e) {
        onProgress(e.loaded, e.total);
      }, false);
    }

    xhr.send(formData);
  };
}

$.extend(ImageService, {
  addService: function(domain, options) {
    this.services = this.services || [];
    this.servicesMap = this.servicesMap || {};
    var service = new ImageService(domain, options);
    this.services.push(service);
    this.servicesMap[domain] = service;
  },

  getThumb: function(url) {
    for(var i = 0, len = this.services.length; i < len; ++i) {
      var service = this.services[i];
      var thumbUrl = service.getThumb(url);
      if(thumbUrl) {
        return thumbUrl;
      }
    }
    return null;
  },

  getService: function(serviceName) {
    return this.servicesMap[serviceName];
  },

  defaultUploadOptions: {
    url: '', 
    signingUrl: 'https://api.twitter.com/1/account/verify_credentials.json',
    params: {
      media: '$file'
    },
    dataType: 'json',
    parseError: null, 
    parseSuccess: null 
  }
});

ImageService.addService('p.twimg.com', {
  thumb: '$2:thumb'
});

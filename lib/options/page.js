var LocaleTable = chrome.extension.getBackgroundPage().LocaleTable;
var ImageService = chrome.extension.getBackgroundPage().ImageService;
var IconCreator = chrome.extension.getBackgroundPage().IconCreator;
var tweetManager = chrome.extension.getBackgroundPage().TweetManager.instance;

chrome.i18n.getMessage = chrome.extension.getBackgroundPage().chrome.i18n.getMessage;

var twitterBackend = tweetManager.twitterBackend;
var options = new Options();
var imgEl = null;

function paintIcon(canvas, color) {
  if(!imgEl) {
    var img = $('<img>').attr('src', 'img/icon.png');
    img.load(function() {
      imgEl = img[0];
      var imgData = IconCreator.paintIcon(imgEl, color);
      canvas.getContext("2d").putImageData(imgData, 0, 0);
    });
  } else {
    var imgData = IconCreator.paintIcon(imgEl, color);
    canvas.getContext("2d").putImageData(imgData, 0, 0);
  }
}


function bindEvents() {
  $("#Yes").bind('click', function() {
    options.confirmRestart();
  });

  $("#No").bind('click', function() {
    options.denyRestart();
  });

  $("#btn_reset_popup_size").bind('click', function() {
    Persistence.popupSize().remove();
  });

  $("#btn_save").bind('click', function() {
    options.save();
  });

  $("#btn_reset").bind('click', function() {
    options.load();
  });

  $("#btn_default").bind('click', function() {
    options.loadDefaults();
  });
}


var hourlyLimit = 350;
$(function() {
  bindEvents();

  $("input.i18n").each(function() {
    $(this).val(chrome.i18n.getMessage(this.id));
  });

  $(".i18n").not("input .htmlSafe").each(function() {
    $(this).text(chrome.i18n.getMessage(this.id));
  });

  $(".i18n.htmlSafe").each(function() {
    $(this).html(chrome.i18n.getMessage(this.id));
  });

  var resetDateObj = new Date();
  if(twitterBackend) {
    var hitsInfo = twitterBackend.remainingHitsInfo();
    $(".twitter_hits_left").text(hitsInfo[0]);

    resetDateObj.setTime(parseInt(hitsInfo[1], 10) * 1000);
    $(".twitter_hits_reset").text(resetDateObj.toLocaleDateString() + " " + resetDateObj.toLocaleTimeString());

    if(hitsInfo[2]) {
      hourlyLimit = parseInt(hitsInfo[2], 10);
    }
  }
  $(".__hourly_limit").text(hourlyLimit);

  $("select[name='default_locale']").append($("<option>").attr('value', 'auto').text(chrome.i18n.getMessage('automatic')));
  for(var localeCode in LocaleTable.instance.locales) {
    $("select[name='default_locale']").append($("<option>").attr('value', localeCode).text(localeCode));
  }

  for(var i = 0, len = ImageService.services.length; i < len; ++i) {
    var service = ImageService.services[i];
    if(service.hasUpload()) {
      $("select[name='image_upload_service']").append($("<option>").attr('value', service.domain).text(service.domain));
    }
  }


  var onSigningUrlCheck = function() {
    var $check = $("input[name='same_signing_urls']");
    if($check.is(':checked')) {
      $("input[name='base_signing_url'], input[name='base_oauth_signing_url']").attr('disabled', 'disabled');
      $("input[name='base_signing_url']").val($("input[name='base_url']").val());
      $("input[name='base_oauth_signing_url']").val($("input[name='base_oauth_url']").val());

      $("input[name='base_url']").bind('keyup blur', function() {
        $("input[name='base_signing_url']").val($(this).val());
      });
      $("input[name='base_oauth_url']").bind('keyup blur', function() {
        $("input[name='base_oauth_signing_url']").val($(this).val());
      });
    } else {
      $("input[name='base_signing_url'], input[name='base_oauth_signing_url']").removeAttr('disabled');

      $("input[name='base_url']").unbind('keyup blur');
      $("input[name='base_oauth_url']").unbind('keyup blur');
    }
  };
  $("input[name='same_signing_urls']").click(onSigningUrlCheck);


  options.onload(function() {

    onSigningUrlCheck();
  });
  options.onsaveChangedOption(function(optionName, oldValue, newValue) {
    var idx, templateId;
    if((idx = optionName.indexOf('_visible')) != -1) {
      templateId = optionName.substring(0, idx);
      if(newValue) {
        tweetManager.showTimelineTemplate(templateId, true);
      } else {
        tweetManager.hideTimelineTemplate(templateId);
      }
    } else if((idx = optionName.indexOf('_include_unified')) != -1) {
      templateId = optionName.substring(0, idx);
      tweetManager.toggleUnified(templateId, newValue);
    }
  });

  options.load();

  var createTTSelect = function(ttLocales) {
    $("select[name='trending_topics_woeid']").empty();
    $.each(ttLocales, function(i, locale){
      $("select[name='trending_topics_woeid']").append($("<option>").attr('value', locale.woeid).text(locale.name));
    });
    $("select[name='trending_topics_woeid']").val(OptionsBackend.get('trending_topics_woeid'));
  };

  createTTSelect(woeids);

  updatePredictedHitsCount();
  $('table.timelines input, table.timelines select').
    keyup(updatePredictedHitsCount).
    blur(updatePredictedHitsCount).
    click(updatePredictedHitsCount).
    change(updatePredictedHitsCount);

});

function updatePredictedHitsCount() {
  var totalHits = 0;

  TimelineTemplate.eachTimelineTemplate(function(template) {

    if(template.id == TimelineTemplate.SEARCH) {
      return true;
    }
    var inputVisibleEl = $('input[name="' +  template.id + '_visible"]');
    if(!inputVisibleEl.is(':checked')) {
      return true;
    }

    var inputRefreshEl = $('input[name="' +  template.id + '_refresh_interval"]');
    var intVal = parseInt(inputRefreshEl.val(), 10);
    var timelineHits = (60 * 60) / intVal;
    var timelineCount = 1;
    if(template.id == TimelineTemplate.DMS) {
      timelineCount = 2;
    } else {
      var userData = template.getUserData();
      if(userData && userData.length > 0) {
        timelineCount = userData.length;
      }
    }

    totalHits += timelineHits * timelineCount;
    return true;
  });
  totalHits += (60 * 60) / (parseInt($('input[name="blockedusers_refresh_interval"]').val(), 10) + 
  							parseInt($('input[name="follow_noise_timeout"]').val(), 10)); 
  totalHits = parseInt(totalHits, 10);
  $('#predicted_hits_count').text(totalHits);
  if(totalHits >= hourlyLimit) {
    $('#predicted_hits_count').css('backgroundColor', 'red');
  } else if(totalHits >= hourlyLimit * 0.85) {
    $('#predicted_hits_count').css('backgroundColor', 'yellow');
  } else {
    $('#predicted_hits_count').css('backgroundColor', 'white');
  }
  return totalHits;
}

function garbageRemoval(_this,username){
	var temp=_this.garbages.pop();
	_this.unfollowUser(function(success) {
		$("#loading").hide();
	},temp);
}
	
function compaction(unFriendThem,_this){
	if((unFriendThem.length>0)&&(unFriendThem!="")){
		toUnFollow=unFriendThem.toString().split(',');
		console.log("Cleaning garbages: " +toUnFollow);
		var interval=OptionsBackend.get('follow_noise_timeout');
		var delay=interval*toUnFollow.length;
		for(var i=0;i<toUnFollow.length;i++){
			_this.garbages=toUnFollow;
			//sleep to keep API limit
			setTimeout(function(){garbageRemoval(_this)},delay);
			delay=delay-interval;
		}
	}
}

function initializeJQueryOptions() {
	$.ajaxSetup({
		timeout: OptionsBackend.get('request_timeout')
	});
}
initializeJQueryOptions();

function ComposerData() {
  this.saveMessage = '';
  this.isComposing = false;
  this.replyId = null;
  this.replyUser = null;
}

function TweetManager() {
  this.unreadTweets = {};
  this.readTweets = {};
  this.shouldNotReadMap = {};
  this.retweets = {};
  this.injectTweets = [];
  this.notifiedRetweets = {};
  this.garbages=[];

  // Using an object instead of an array to take advantage of hash look-ups
  this.blockedUserNames = {};

  this.newTweetsCallback = null;

  this.composerData = new ComposerData();

  this.timelines = {};
  this.iconImg = null;
  this.listsCache = null;
  this.listsTabCount = OptionsBackend.get('lists_count');

  this.suspend = false;

  this.timelineOrderData = Persistence.timelineOrder();
  this.oauthTokenData = Persistence.oauthTokenData();
  this.oauthTokenService = Persistence.oauthTokenService();

  var currentService = OptionsBackend.get('microblogging_service');
  if(!this.oauthTokenService.val()) {
    this.oauthTokenService.save(currentService);
  } else if(currentService != this.oauthTokenService.val()) {
    this.oauthTokenService.save(currentService);
    this.oauthTokenData.remove();
  }

  var _this = this;

  TimelineTemplate.initTemplates(this);
  TimelineTemplate.eachTimelineTemplate(function(template) {
    _this.createTimelineTemplate(template, true);
  });

  this.orderedEachTimeline(function(timeline) {
    _this.currentTimelineId = timeline.timelineId;
    return false;
  }, true);
  this.previousTimelineId = null;

  this.warningsCallback = null;
  this.warningMessage = null;
  this.autoClearWarning = false;

  this.maxApiHitsStates = 30;
  this.apiHitsStates = [];
  this.firstPossibleWarnTime = null;
  
  this.ttLocales = null;

  this.authenticated = false;

  this.initIconAndAlerts();

  this.twitterBackend = new TwitterLib(
    function onAuthenticated() {
      TimelineTemplate.initAfterAuthentication();
      _this.authenticated = true;
      _this.retrieveBlockedUsers();
      _this.lists();
      _this.eachTimeline(function(timeline) {
        timeline.init();
      }, true);
      _this.retrieveFollowingUsers();
      StreamListener.start(this);
    },
    function(remainingHits, nextHitsReset, hourlyLimit) {
      _this.onHitsUpdated.call(_this, remainingHits, nextHitsReset, hourlyLimit);
    },
    OptionsBackend.get('microblogging_service'),
    OptionsBackend.get('base_url'),
    OptionsBackend.get('base_oauth_url'),
    OptionsBackend.get('base_signing_url'),
    OptionsBackend.get('base_oauth_signing_url'),
    OptionsBackend.get('base_search_url'),
    this.oauthTokenData);

  this.sendQueue = new SendQueue(this.twitterBackend);
}

TweetManager.prototype = {

  disableDMS: function() {
    this.hideTimelineTemplate(TimelineTemplate.DMS);
    this.toggleUnified(TimelineTemplate.DMS, false);
    var views = chrome.extension.getViews({type: 'popup'});
    if(views) {
      for(var i = 0; i < views.length; ++i) {
        if(views[i].TimelineTab) {
          views[i].TimelineTab.removeTab(TimelineTemplate.DMS);
          break;
        }
      }
    }
    this.setWarning("Direct messages tab have been disabled for now. This is happening because Twitter's denying access to them for some bizarre reason. You can try enabling them again in the options page.");
  },

  showTimelineTemplate: function(timelineTemplateId, showOnly) {
    var template = TimelineTemplate.getTemplate(timelineTemplateId);
    template.setVisible(true);
    return this.createTimelineTemplate(template, showOnly);
  },

  hideTimelineTemplate: function(timelineTemplateId) {
    var template = TimelineTemplate.getTemplate(timelineTemplateId);
    template.setVisible(false);
    var toDelete = [];
    this.eachTimeline(function(timeline) {
      if(timeline.template.id == timelineTemplateId) {
        timeline.killTimeline();
        toDelete.push(timeline);
      }
    }, true);
    for(var i = 0, len = toDelete.length; i < len; ++i) {
      var timeline = toDelete[i];
      delete this.timelines[timeline.timelineId];
    }
  },

  createTimelineTemplate: function(template, showOnly) {
    var createdTimelines = [];
    var shownTimelines = [];
    if(template.multipleTimelines && !showOnly) {
      createdTimelines = [template.addTimeline()];
    } else {
      var createTimelines = true;
      this.eachTimeline(function(timeline) {
        if(timeline.template.id == template.id) {
          createTimelines = false;
          shownTimelines.push(timeline);
        }
      });
      if(createTimelines) {
        createdTimelines = template.createTimelines();
      }
    }
    for(var i = 0, len = createdTimelines.length; i < len; ++i) {
      var timeline = createdTimelines[i];
      this.timelines[timeline.timelineId] = timeline;
      if(this.authenticated) {
        timeline.init();
      }
      shownTimelines.push(timeline);
    }
    return shownTimelines;
  },

  hideTimeline: function(timelineId){
    var timeline = this.timelines[timelineId];
    if(!timeline) {
      return;
    }
    var shouldDelete = timeline.remove();
    if(shouldDelete) {
      delete this.timelines[timelineId];
    }
  },

  toggleNotify: function(templateId) {
    var template = TimelineTemplate.getTemplate(templateId);
    var newState = !template.showOnPageNotification;
    template.setShowOnPageNotification(newState);
  },

  toggleChangeIcon: function(templateId) {
    var template = TimelineTemplate.getTemplate(templateId);
    var newState = !template.showIconNotification;
    template.setShowIconNotification(newState);
  },

  setWarning: function(msg, showHTML) {
    this.warningMessage = msg;
    this.warningMessageHTML = showHTML;
    try {
      if(this.warningsCallback) {
        this.warningsCallback(msg, showHTML);
      }
    } catch(e) {
      /* ignoring, the popup window might be closed. */
    }
  },

  clearWarning: function() {
    this.warningMessage = null;
  },

  registerWarningsCallback: function(callback) {
    this.warningsCallback = callback;
    if(this.warningMessage && this.warningsCallback) {
      this.warningsCallback(this.warningMessage, this.warningMessageHTML);
    }
  },

  /**
  * Update this.blockedUsers and schedule another update after
  * "blockedusers_refresh_interval" time has elapsed.
  */
  retrieveBlockedUsers: function(errWaitTime) {
    var _this = this;
    this.twitterBackend.blockedUsers(function(success, users, status, context) {
        var refreshTime;
        if(success) {
          _this.blockedUserNames = {};
          for(var i = 0, len = users.length; i < len; ++i) {
            var user = users[i];
            _this.blockedUserNames[user.screen_name] = user;
          }
          refreshTime = OptionsBackend.get('blockedusers_refresh_interval');
          errWaitTime = null;

          _this.eachTimeline(function(timeline) {
            timeline.purgeBlockedTweets();
          }, true);
        } else {
          if(!errWaitTime) {
            errWaitTime = 5000;
          }
          refreshTime = errWaitTime;
          errWaitTime *= 2;
        }

        setTimeout(function() { _this.retrieveBlockedUsers(errWaitTime); }, refreshTime);
    });
  },

  eachTimeline: function(callback, includeHidden) {
    for(var tId in this.timelines) {
      var timeline = this.timelines[tId];
      if(!includeHidden && (!timeline.template.visible || timeline.template.hiddenTemplate)) {
        continue;
      }
      if(callback.call(tId, timeline) === false) {
        break;
      }
    }
  },

  /* Lists timelines won't be included as they'll only be shown later */
  orderedEachTimeline: function(callback, includeLists) {
    var retList = [], tId, timeline;
    for(tId in this.timelines) {
      timeline = this.timelines[tId];
      if(!includeLists && timeline.template.id == TimelineTemplate.LISTS) {
        continue;
      }
      var orderedPos = this.getTimelinePosition(tId);
      if(orderedPos == -1) {
        orderedPos = retList.length;
      }
      if(retList[orderedPos]) {
        retList.splice(orderedPos, 0, tId);
      } else {
        retList[orderedPos] = tId;
      }
    }
    for(var i = 0; i < retList.length; ++i) {
      tId = retList[i];
      if(tId) {
        timeline = this.timelines[tId];
        if(timeline.template.visible && !timeline.template.hiddenTemplate) {
          var ret = callback.call(tId, timeline);
          if(ret === false) {
            break;
          }
        }
      }
    }
  },

  getTimelinePosition: function(timelineId) {
    if(!this.timelineOrderCache) {
      var storedOrder = this.timelineOrderData.val();
      if(storedOrder) {
        this.timelineOrderCache = JSON.parse(storedOrder);
      } else {
        this.timelineOrderCache = [];
      }
    }
    for(var i = 0; i < this.timelineOrderCache.length; ++i) {
      if(timelineId == this.timelineOrderCache[i]) {
        return i;
      }
    }
    return -1;
  },

  setTimelineOrder: function(sortedTimelinesArray) {
    this.timelineOrderCache = sortedTimelinesArray.slice(0);
    this.timelineOrderData.save(JSON.stringify(sortedTimelinesArray));
  },

  initIconAndAlerts: function() {
    var $icon = $('<img>').attr('src', 'img/icon100.png');
    this.iconImg = $icon[0];
    var _this = this;
    $icon.load(function() {
      _this.updateAlert();
    });
  },

  unique: function(srcList) {
    var newList = [];
    for(var i = 0; i < srcList.length; ++i) {
      if($.inArray(srcList[i], newList) == -1) {
        newList[newList.length] = srcList[i];
      }
    }
    return newList;
  },

  updateAlert: function() {
    var colors = [];
    var unreadNewTweets = [];
    var totalUnreadNewIds = [];
    this.eachTimeline(function(timeline) {
      var timelineId = this;
      //var unreadNewIds = timeline.getNewUnreadIds();
      var unreadNewIds=timeline.getNewFilteredUnreadTweets(timeline);    
      var timelineTemplate = timeline.template;
      if(timelineTemplate.showIconNotification) {
        totalUnreadNewIds = totalUnreadNewIds.concat(unreadNewIds);
        if(unreadNewIds.length > 0) { 
          colors.push(timelineTemplate.iconNotificationColor);
        }
      }
      if(timelineTemplate.showOnPageNotification) {
        unreadNewTweets = unreadNewTweets.concat(timeline.getNewUnreadTweets());
      }
    }, true);
    var totalUnreadNewCount = this.unique(totalUnreadNewIds).length;
//alert('totalUnreadNewCount '+totalUnreadNewCount);
    if(colors.length === 0) {	
      chrome.browserAction.setTitle({title: "k-Subscription"});
      chrome.browserAction.setIcon({imageData: IconCreator.paintIcon(this.iconImg, OptionsBackend.get('idle_color'))});
      chrome.browserAction.setBadgeText({text: ''});
    } else {
      var tweet_string = totalUnreadNewCount > 1 ? 'newtweets_plural' : 'newtweets_singular';
      var title = chrome.i18n.getMessage("newTweets", [totalUnreadNewCount, chrome.i18n.getMessage(tweet_string)]);
      chrome.browserAction.setTitle({title: title});
      chrome.browserAction.setIcon({imageData: IconCreator.paintIcon(this.iconImg, colors)});
      chrome.browserAction.setBadgeBackgroundColor({color: [255, 0, 0, 0]});
      chrome.browserAction.setBadgeText({text: '' + totalUnreadNewCount});
    }
  },

  registerNewTweetsCallback: function(callback) {
    this.newTweetsCallback = callback;
  },

  readTweet: function(id) {
    if(this.shouldNotReadMap[id]) {
      delete this.shouldNotReadMap[id];
      return;
    }
    this.readTweets[id] = true;
    delete this.unreadTweets[id];
    this.notifyNewTweets();
  },

  isTweetRead: function(id) {
    return !this.unreadTweets[id];
  },

  isRetweet: function(tweet) {
    return this.retweets[tweet.id] || tweet.current_user_retweet;
  },

  notifyNewTweets: function() {
  //console.warn("notifyNewTweets tweet_Manager");
    if(this.newTweetsCallback) {
      var _this = this;
      this.eachTimeline(function(timeline) {
        var newTweets = timeline.newTweetsCount();
        try {
          // The callback might be invalid (popup not active), so let's ignore errors for now.
          _this.newTweetsCallback(newTweets[0], newTweets[1], timeline.timelineId);
        } catch(e) { /* ignoring */ }
      });
    }

    this.updateAlert();
  },

  enqueueTweet: function(msg, replyId) {
    this.sendQueue.enqueueTweet(msg, replyId);
  },

  postRetweet: function(callback, id) {
    var _this = this;
    return this.twitterBackend.retweet(function(success, data, status) {
      if(success) {
        _this.retweets[id] = true;
      }
      callback(success, data, status);
    }, id);
  },

  getInReplyToTweet: function(callback, tweet) {
    if(tweet.inReplyToTweet) {
      callback(true, tweet.inReplyToTweet);
      return;
    }
    var _this = this;
    this.twitterBackend.showTweet(function(success, data, status) {
      if(success) {
        tweet.inReplyToTweet = data;
      }
      callback(success, data, status);
    }, tweet.in_reply_to_status_id);
  },

  destroy: function(callback, tweetTimelineId, id) {
    var _this = this;
    var firstCallback = function(success, data, status) {
      if(success) {
        _this.eachTimeline(function(timeline) {
          timeline.removeFromCache(id);
        }, true);
      }
      callback(success, data, status);
    };
    if(tweetTimelineId == TimelineTemplate.RECEIVED_DMS || tweetTimelineId == TimelineTemplate.SENT_DMS) {
      return this.twitterBackend.destroyDM(firstCallback, id);
    } else {
      return this.twitterBackend.destroy(firstCallback, id);
    }
  },
  
  lists: function(force, callback) {
    if(force) {
      this.listsCache = null;
    }
    if(!this.listsCache) {
      var _this = this;
      this.twitterBackend.lists(function(success, data, status) {
        if(success) {
          if(!data.lists) {
            data.lists = [];
          }
          _this.listsCache = data.lists;
          _this.twitterBackend.subs(function(success, data, status) {
            if(success) {
              if(!data.lists) {
                data.lists = [];
              }
              _this.listsCache = _this.listsCache.concat(data.lists);
            }
            if(callback) {
              callback(success, _this.listsCache, status);
            }
          });
        } else {
          if(callback) {
            callback(success, _this.listsCache, status);
          }
        }
      });
      return;
    }
    if(callback) {
      callback(true, this.listsCache, null);
    }
  },

  changeSearch: function(timelineId, searchQuery) {
    var timeline = this.timelines[timelineId];
    if(!timeline) {
      return false;
    }
    return timeline.changeSearchQuery(searchQuery);
  },

  getSearchQuery: function(timelineId) {
    var timeline = this.timelines[timelineId];
    if(!timeline) {
      return null;
    }
    return timeline.getSearchQuery();
  },

  giveMeTweets: function(timelineId, callback, syncNew, cacheOnly) {
    var timeline = this.timelines[timelineId];
    if(!timeline) {
      callback([], timelineId);
      return undefined;
    }
    if(syncNew && timeline.template.includeInUnified) {
      var originalCallback = callback;
      var _this = this;
      callback = function(tweets, timelineId) {
        originalCallback(tweets, timelineId);
        _this.timelines[TimelineTemplate.UNIFIED].giveMeTweets(originalCallback, false, true);
      };
    }
    return timeline.giveMeTweets(callback, syncNew, cacheOnly);
  },

  newTweetsCount: function(timelineId) {
    return this.timelines[timelineId].newTweetsCount();
  },

  updateNewTweets: function() {
    var currentTimeline = this.timelines[this.currentTimelineId];
    currentTimeline.updateNewTweets();
    this.updateAlert();
  },

  getCurrentTimeline: function() {
    var currentTimeline = this.timelines[this.currentTimelineId];

    if (!currentTimeline) {
      var _this = this;
      this.orderedEachTimeline(function(timeline) {
        currentTimeline = _this.currentTimelineId = timeline.timelineId;
        return false;
      }, true);
    }

    return currentTimeline;
  },

  getTimeline: function(timelineId) {
    return this.timelines[timelineId];
  },

  currentError: function() {
    return this.timelines[this.currentTimelineId].getError();
  },

  suspendTimelines: function(suspend) {
    var oldSuspendState = this.suspend;
    if(suspend !== undefined) {
      this.suspend = suspend;
    } else {
      this.suspend = !this.suspend;
    }
    if(oldSuspendState != this.suspend) {
      if(this.suspend) {
        StreamListener.disconnect(true);
      } else {
        StreamListener.start(this.twitterBackend);
      }
    }
    return this.suspend;
  },

  stopAll: function() {
    this.eachTimeline(function(timeline) {
      timeline.killTimeline();
      delete timeline;
    }, true);
    StreamListener.disconnect();
  },

  signout: function() {
    this.oauthTokenData.remove();
    this.stopAll();
    TweetManager.instance = new TweetManager();
    var views = chrome.extension.getViews({type: 'popup'});
    if(views) {
      for(var i = 0; i < views.length; ++i) {
        views[i].close();
      }
    }
    return (views && views.length > 0);
  },

  signoutAndReauthenticate: function(attribute) {
    if(this.signout()) {
      TweetManager.instance.twitterBackend.startAuthentication();
    }
  },

  restart: function() {
    this.stopAll();
    initializeJQueryOptions();
    TweetManager.instance = new TweetManager();
  },

  markTimelineAsRead: function() {
    var tweetsToRead = this.getCurrentTimeline().getTweetsCache();
    for(var i = 0; i < tweetsToRead.length; ++i) {
      this.readTweet(tweetsToRead[i].id);
    }
  },

  onHitsUpdated: function(remainingHits, nextHitsReset, hourlyLimit) {
    var nextResetDate = new Date();
    nextResetDate.setTime(parseInt(nextHitsReset, 10) * 1000);
    if(remainingHits === 0) {
      this.autoClearWarning = true;
      this.setWarning(chrome.i18n.getMessage("exceededAPIHits", [chrome.extension.getURL('options.html'), nextResetDate.toLocaleDateString(), nextResetDate.toLocaleTimeString()]), true);
      return;
    }
    if(this.autoClearWarning) {
      this.autoClearWarning = false;
      this.clearWarning();
    }

    if(this.apiHitsStates.length > 0) {
      if(remainingHits > this.apiHitsStates[this.apiHitsStates.length - 1][1]) {
        // Rate limit was reset
        this.apiHitsStates = [];
      }
    }

    this.apiHitsStates.push([(new Date()).getTime(), parseInt(remainingHits, 10)]);
    if(this.apiHitsStates.length > this.maxApiHitsStates) {
      this.apiHitsStates.shift();
    }
    if(this.apiHitsStates.length > 20) {
      var offset = this.apiHitsStates[0][0];
      var tendencyFunction = Math.linearLeastSquares(this.apiHitsStates, offset);
      var projectedRemainingHits = tendencyFunction(nextResetDate.getTime() - offset);
      if(projectedRemainingHits < 0) {
        if(this.firstPossibleWarnTime) {
          var timeDiff = new Date() - this.firstPossibleWarnTime;
          if(timeDiff > 3 * 60 * 1000) {
            this.setWarning(chrome.i18n.getMessage("warmingAPIHits", [chrome.extension.getURL('options.html'), remainingHits, nextResetDate.toLocaleDateString(), nextResetDate.toLocaleTimeString()]));
            this.firstPossibleWarnTime = null;
          }
        } else {
          this.firstPossibleWarnTime = new Date();
        }
      } else {
        this.firstPossibleWarnTime = null;
      }
    }
  },

	retrieveUsersData: function(usersIdList) {
		var _this = this;
		this.twitterBackend.lookupUsers(function(success, users) {
			if(!success) {
				// Try again in a while...
				setTimeout(function() {
					_this.retrieveUsersData(usersIdList);
				}, 120000);
				return;
			}
			for(var i = 0, len = users.length; i < len; ++i) {
				var user = users[i];
				_this.followingUsersMap[user.screen_name] = user;
				_this.followingUsersNames.push(user.screen_name);
			}
			var channelsToRemove=checkFriends(_this.followingUsersNames);
			compaction(channelsToRemove,_this);
			_this.followingUsersNames.sort(function(a, b) {
				return a.toUpperCase().localeCompare(b.toUpperCase());
			});
		}, usersIdList);
	},

	retrieveFollowingUsers: function() {
		this.followingUsersNames = [];
		this.followingUsersMap = {};
		var _this = this;
		this.twitterBackend.friendsIds(function(success, usersData) {
			if(!success) {
				// Try again in a while...
				setTimeout(function() {
					_this.retrieveFollowingUsers();
				}, 120000);
				return;
			}
			var idsList = usersData.ids;
			if(!idsList) {
				idsList = [];
			}
			//alert('realsss '+Math.ceil(idsList.length / 100.0));
			for(var i = 0, len = Math.ceil(idsList.length / 100.0); i < len; ++i) {
				var firstIndex = i * 100;
				var idsListSlice = idsList.slice(firstIndex, firstIndex + 100);
				_this.retrieveUsersData(idsListSlice);
			}
			if(Math.ceil(idsList.length / 100.0)==0){
				var channelsToRemove=checkFriends(0);
				compaction(channelsToRemove,_this);
			}
		});
	},

	getFollowingUsers: function() {
		return this.followingUsersNames;
	},

	getFollowingUsersMap: function() {
		return this.followingUsersMap;
	},

	resetTimeline: function(timelineId) {
		var timeline = this.getTimeline(timelineId);
		if(timeline)
			timeline.reset();
	},

  followUser: function(callback, username) {
    var _this = this;
    this.twitterBackend.follow(function(success, userData) {
      if(success) {
        _this.followingUsersMap[userData.screen_name] = userData;
        _this.followingUsersNames.push(userData.screen_name);
        _this.followingUsersNames.sort(function(a, b) {
          return a.toUpperCase().localeCompare(b.toUpperCase());
        });
        _this.resetTimeline(TimelineTemplate.HOME);
        _this.resetTimeline(TimelineTemplate.UNIFIED);
      }
      callback(success, userData);
    }, username);
  },

  _removeUser: function(userData, isBlocked) {
    delete this.followingUsersMap[userData.screen_name];
    var position = $.inArray(userData.screen_name, this.followingUsersNames);
    if(position > -1) {
      this.followingUsersNames.splice(position, 1);
    }
    this.resetTimeline(TimelineTemplate.HOME);
    this.resetTimeline(TimelineTemplate.UNIFIED);

    if(isBlocked) {
      this.blockedUserNames[userData.screen_name] = userData;
      this.eachTimeline(function(timeline) {
        timeline.purgeBlockedTweets();
      }, true);
    }
  },

  unfollowUser: function(callback, username) {
    var _this = this;
    this.twitterBackend.unfollow(function(success, userData) {
      if(success) {
        _this._removeUser(userData);
      }
      callback(success, userData);
    }, username);
  },

  blockUser: function(callback, username) {
    var _this = this;
    this.twitterBackend.block(function(success, userData) {
      if(success) {
        _this._removeUser(userData, true);
      }
      callback(success, userData);
    }, username);
  },

  reportUser: function(callback, username) {
    var _this = this;
    this.twitterBackend.report(function(success, userData) {
      if(success) {
        _this._removeUser(userData, true);
      }
      callback(success, userData);
    }, username);
  },

  retrieveTrendingTopics: function(callback, woeid) {
    var _this = this;

    if(this.lastTrendsTime && this.cachedTrendingTopics && (new Date() - this.lastTrendsTime) < 90 * 1000) {
      setTimeout(function() {
        callback(_this.cachedTrendingTopics);
      }, 0);
      return;
    }
    this.lastTrendsTime = new Date();

    this.twitterBackend.trendingTopics(function(success, userData) {
      if(success) {
        _this.cachedTrendingTopics = userData[0];
      }
      callback(_this.cachedTrendingTopics);
    }, woeid);
  },

  worldWideWoeid: {
    woeid: 1,
    name: 'Worldwide'
  },
  };

/* Clean up old versions mess */
Persistence.cleanupOldData();

function compareVersions(v1, v2) {
  if(!v1) return -1;
  if(!v2) return 1;
  var maxLen = Math.max(v1.length, v2.length);
  for(var i = 0; i < maxLen; ++i) {
    if(v1[i] === undefined) return -1;
    if(v2[i] === undefined) return 1;
    if(parseInt(v1[i], 10) > parseInt(v2[i], 10)) return 1;
    if(parseInt(v1[i], 10) < parseInt(v2[i], 10)) return -1;
  }
  return 0;
}

function checkVersionChanges(manifest) {
  try {
    var currentVersion = manifest.version.split('.');
    var storageData = Persistence.version();
    var storageVersion = storageData.val();
    var options, baseUrl;
    if(storageVersion) {
      storageVersion = JSON.parse(storageVersion);
    } else {
      // No previous version data let's just assume we're running the latest version
      storageData.save(JSON.stringify(currentVersion));
      return;
    }

    if(compareVersions(currentVersion, storageVersion) !== 0) {
      if(compareVersions(storageVersion, [1, 3, 0]) < 0) {
        //Old default refresh interval, let's update it for the new version
        if(OptionsBackend.get('home_refresh_interval') == 60000) {
          options = OptionsBackend.load();
          options['home_refresh_interval'] = OptionsBackend.defaultOptions['home_refresh_interval'];
          OptionsBackend.save(options);
        }
      }
      if(compareVersions(storageVersion, [1, 5, 1]) <= 0) {
        var timelineOrderData = Persistence.timelineOrder();
        var storedOrder = timelineOrderData.val();
        if(storedOrder) {
          storedOrder = JSON.parse(storedOrder);
        } else {
          storedOrder = [];
        }
        storedOrder.unshift('unified');
        timelineOrderData.save(JSON.stringify(storedOrder));
      }
      if(compareVersions(storageVersion, [1, 6, 1]) <= 0) {
        options = OptionsBackend.load();
        baseUrl = options['base_url'];
        if(baseUrl.match(/http:\/\/twitter\.com/)) {
          options['base_url'] = 'http://api.twitter.com/1/';
          options['base_signing_url'] = 'http://api.twitter.com/1/';
        } else if(baseUrl.match(/https:\/\/twitter\.com/)) {
          options['base_url'] = 'https://api.twitter.com/1/';
          options['base_signing_url'] = 'https://api.twitter.com/1/';
        }
        OptionsBackend.save(options);
      }
      if(compareVersions(storageVersion, [1, 7, 0]) <= 0) {
        var selectedListsData = Persistence.selectedLists();
        var selectedListsInfo = selectedListsData.val();
        if(selectedListsInfo) {
          var selectedObj = JSON.parse(selectedListsInfo);
          if(selectedObj) {
            var listsIdList = [];
            for(var key in selectedObj) {
              var listId = selectedObj[key];
              listsIdList.push(listId);
            }
            TweetManager.instance.hideTimelineTemplate(TimelineTemplate.LISTS);
            var listsTemplate = TimelineTemplate.getTemplate(TimelineTemplate.LISTS);
            listsTemplate.setUserData(listsIdList);
            TweetManager.instance.showTimelineTemplate(TimelineTemplate.LISTS, true);
          }
        }
        selectedListsData.remove();
      }
      if(compareVersions(storageVersion, [1, 8, 0]) <= 0) {
        var requestTimeout = OptionsBackend.get('request_timeout');
        if(requestTimeout == 6000) {
          requestTimeout = OptionsBackend.defaultOptions['request_timeout'];
          OptionsBackend.saveOption('request_timeout', requestTimeout);
          initializeJQueryOptions();
        }

        baseUrl = OptionsBackend.get('base_url');
        var baseSigningUrl = OptionsBackend.get('base_signing_url');
        if(baseUrl == baseSigningUrl && baseUrl == 'http://api.twitter.com/1/') {
          baseUrl = OptionsBackend.defaultOptions['base_url'];
          baseSigningUrl = OptionsBackend.defaultOptions['base_signing_url'];
          OptionsBackend.saveOption('base_url', baseUrl);
          OptionsBackend.saveOption('base_signing_url', baseSigningUrl);
          TwitterLib.URLS.BASE = baseUrl;
          TwitterLib.URLS.BASE_SIGNING = baseSigningUrl;
        }
      }
      if(compareVersions(storageVersion, [1, 8, 5]) <= 0) {
        OptionsBackend.saveOption('tweets_notification_style', 'desktop');
      }

      if(compareVersions(storageVersion, [1, 9, 6, 6]) <= 0) {
        var baseOauthUrl = OptionsBackend.get('base_oauth_url');
        var baseOauthSignUrl = OptionsBackend.get('base_oauth_signing_url');
        if(baseOauthUrl == 'https://twitter.com/oauth/') {
          OptionsBackend.setDefault('base_oauth_url');
        }
        if(baseOauthSignUrl == 'https://twitter.com/oauth/') {
          OptionsBackend.setDefault('base_oauth_signing_url');
        }
      }
      if(compareVersions(storageVersion, [1, 9, 7, 0]) <= 0) {
        OptionsBackend.setDefault('use_streaming_api');
      }
      storageData.save(JSON.stringify(currentVersion));
    }
  } catch(e) {
    /* experimental code, something can go wrong */
    console.log(e);
  }
}

initializeExtension();
$.ajax({
  type: 'GET',
  url: 'manifest.json',
  data: {},
  dataType: "json",
  timeout: 5000,
  success: function(data, status) {
    checkVersionChanges(data);
  },
  error: function (request, status, error) {
    try {
      checkVersionChanges(JSON.parse(request.responseText));
    } catch(e) {
      /* Something can go wrong, ignoring... */
    }
  }
});

function initializeExtension() {
  TweetManager.instance = new TweetManager();

  var waitingFirstRequest = true;
  var selectedResponse = null;
  var biggestArea = -1;
  chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    if(request.cb_requesting_tweets) {
      if(waitingFirstRequest) {
        waitingFirstRequest = false;
        setTimeout(function() {
          if(selectedResponse) {
            selectedResponse({
              tweets: TweetManager.instance.injectTweets,
              nameAttribute: OptionsBackend.get('name_attribute'),
              fadeTimeout: OptionsBackend.get('notification_fade_timeout')
            });
          }
          waitingFirstRequest = true;
          TweetManager.instance.injectTweets = [];
          biggestArea = -1;
        }, 200);
      }
      var area = request.frame_area;
      if(area >= biggestArea) {
        biggestArea = area;
        selectedResponse = sendResponse;
      }
      return;
    }
  });
}

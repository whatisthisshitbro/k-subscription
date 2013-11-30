var ContextMenu = {
  init: function(selector) {
    var _this = this;
    if(!selector) {
      selector = 'ul.ui-tabs-nav';
    }
    $(selector).contextMenu({
      menu: 'tab_context_menu',
      onBeforeShow: function(el) {
        return _this.createMenu(el);
      }
    }, function(action, el, pos) {
      return _this.runMenuAction(action, el, pos);
    });
  },

  initSingleTimeline: function(timelineId) {
    this.init('#tab_\\#timeline-' + timelineId);
  },

  runMenuAction: function(action, el, pos) {
    var actionParts = action.split('-');
    var templateId = actionParts[1];
    if(actionParts[0] == 'show') {
      TimelineTab.addNewTab(templateId);
    } else if(actionParts[0] == 'remove') {
      var timelineId = actionParts[1];
      TimelineTab.removeTab(timelineId);
      if(tweetManager.getCurrentTimeline().template.id == TimelineTemplate.UNIFIED) {
        prepareAndLoadTimeline();
      }
    } else if(actionParts[0] == 'unified') {
      tweetManager.toggleUnified(templateId);
      if(tweetManager.getCurrentTimeline().template.id == TimelineTemplate.UNIFIED) {
        prepareAndLoadTimeline();
      }
    } else if(actionParts[0] == 'notify') {
      tweetManager.toggleNotify(templateId);
    } else if(actionParts[0] == 'icon') {
      tweetManager.toggleChangeIcon(templateId);
    }
  },

  createMenu: function(el) {
    var specificMenu = [];
    var timeline = null;
    if(el.is('.timeline_tab')) {
      timeline = tweetManager.getTimeline(el[0].id.split('-')[1]);
      var label = chrome.i18n.getMessage("remove");
      if(timeline.template.includeInUnified && !timeline.template.multipleTimelines) {
        label = chrome.i18n.getMessage("hide");
      }
      specificMenu.push({action: 'remove-' + timeline.timelineId, label: label + ' Tab'});
    }

    var generalMenu = [];
    TimelineTemplate.eachTimelineTemplate(function(template) {
      if(!template.visible || template.multipleTimelines) {
        var label = chrome.i18n.getMessage("show");
        if(template.multipleTimelines) {
          label = chrome.i18n.getMessage("add");
        }
        generalMenu.push({action: 'show-' + template.id, label: label + " " + template.timelineName + ' Tab'});
      }
    });

    if(specificMenu.length > 0 && generalMenu.length > 0) {
      specificMenu.push({label: 'separator'});
    }

    return specificMenu.concat(generalMenu);
  }

};

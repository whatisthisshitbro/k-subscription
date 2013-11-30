$.ajaxSetup({
  timeout: OptionsBackend.get('request_timeout')
});

var reply_all = OptionsBackend.get('reply_all');

$.extend($.ui.tabs.prototype, {
  refreshPositions: function() {
    return this._tabify();
  }
});

$.fn.hoverFor = function(time, mainCallback, startingCallback, abortCallback) {
  return this.each(function(){
    var _this = this, timeoutHandle, triggerFired = false;
    $(this).hover(
      function() {
        if(triggerFired)
          return;
        if(startingCallback)
          startingCallback.call(_this);
        timeoutHandle = setTimeout(function() {
          triggerFired = true;
          mainCallback.call(_this);
          timeoutHandle = null;
        }, time);
      },
      function() {
        if(triggerFired)
          return;
        if(timeoutHandle) {
          if(abortCallback)
            abortCallback.call(_this);
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
      }
    );
 });
};

function intercept()
{ 
	try 
	{
		chrome.webRequest.onBeforeRequest.addListener(
  		function(info) {
			var follow=OptionsBackend.get('follow_interception');
			if(follow==true) //intercept follows
			{
				alert("Your action has been intercepted. In order to keep your anonymity you have to make these actions through your k-Subscription extension. \n\nYou can disable this interception from k-subscription options");
				return {redirectUrl: "about:blank"};
			}
			else
			{
				//var unFriendThem=checkFriends();
				//if((unFriendThem.length==0)||(unFriendThem==""))//needs to unfollow noise
					reloadExtension();
				return {redirectUrl: info.url};
			}
  		},
  		{
    		urls: [
      			"https://twitter.com/i/user/follow",
				"https://twitter.com/intent/follow",
				"https://twitter.com/i/user/unfollow",
				"https://twitter.com/intent/*",
    		],
  		},
  		["blocking"]);
	}
    catch (ErrorMessage)
    {
    	alert('page:'+ErrorMessage);
    }
}

function reloadExtension(){
	window.location.reload();
}

intercept();
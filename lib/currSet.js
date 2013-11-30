function appendchnls() {
	var OptionsBackend = chrome.extension.getBackgroundPage().OptionsBackend;
	var chnls=OptionsBackend.get('defaultChannels');
	var x = document.getElementById('xdiv');
	var r = x.appendChild(document.createElement('table'));
	var count=0;
	for (var i=chnls.length-1; i>=0; i--) {
    	t = r.insertRow(0); 
    	c = t.insertCell(0);
		if (chnls[i].friend==true)
		{	
			count++;
			c.innerHTML="<b><font color='red'>"+chnls[i].friend+"</font></b>";
		}
		else
			c.innerHTML=chnls[i].friend;
    	c = t.insertCell(0);
		c.innerHTML=chnls[i].followers;
    	c = t.insertCell(0);
		c.innerHTML=chnls[i].chnl;
		c = t.insertCell(0);
		c.innerHTML=i;
	}
	t = r.insertRow(0);
	c = t.insertCell(0);
	c.innerHTML="<strong>Friends? </strong>("+count+")";
	c = t.insertCell(0);
	c.innerHTML="<strong>Followers</strong>";
	c = t.insertCell(0);
	c.innerHTML="<strong>Channel</strong>";
	c = t.insertCell(0);
	c.innerHTML="<strong>No.</strong>";
}

window.onload = appendchnls;

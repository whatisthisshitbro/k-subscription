var norm = new Array();
var sum=0;
function get_fast(){
	needle=Math.random();
	high=norm.length-1;
	low=0;
	while(low<high){
		probe=Math.ceil((high+low)/2);
		if(norm[probe]<needle)
			low=probe+1;
		else if(norm[probe]>needle)
			high=probe-1;
		else
			return probe;
	}
	if(low!=high)
		return (norm[low]>=needle)?low:probe;
	else
		return (norm[low]>=needle)?low:low+1;
}


function getNoise(k,username){
	data=OptionsBackend.get('defaultChannels');
	var foundInS=false;
	for (i=0;i<data.length;i++){
		sum+=data[i].followers;
		norm[i]=sum;
		if(data[i].chnl.toUpperCase()==username.toUpperCase())
			foundInS=true;
	}
	if(!(foundInS))
		return 0;
	var tmp=new Array(data.length);
	for(i=0;i<data.length;i++)
	{
		norm[i]=norm[i]/sum;
		tmp[i]=0; //mark empty space in dummy directory
		if(data[i].chnl.toUpperCase()==username.toUpperCase())
		{
			data[i].friend=true;// real channel
			tmp[i]=1;
		}
	}
	channels=new Array();
	while(channels.length<k-1)
	{
		id=get_fast();
		tmp[id]=1;
		if (data[id].friend==false)
		{
			channels.push(data[id].chnl);
			data[id].friend=true;
		}
		if (tmp.indexOf(0)<0)
			break; //There is not enough noise
	}
	var reals=OptionsBackend.get('real_channel');
	reals.push({chnl:username,noise:channels});
	OptionsBackend.saveOption('real_channel',reals);
	var temp=jQuery.extend(true, [], channels);
	return temp;
}
function checkFriends(friends){
	var set=OptionsBackend.get('defaultChannels');
	var unfollowThem=[];
	var reals=OptionsBackend.get('real_channel');
	var realA=[];
	var realB=[];
	for(var i=0;i<reals.length;i++)
	{	
		realA.push(reals[i].chnl.toLowerCase());
		realB.push(reals[i].noise);
	}
	for(var i=0;i<set.length;i++)
	{
		if((friends==0)||(friends.indexOf(set[i].chnl)<0)) //is not friend
		{
			set[i].friend=false;
			//look if it was real and needs to remove its noise too
			var index=realA.indexOf(set[i].chnl.toLowerCase());
			if(index>-1){
				console.log("Garbage has been detected: "+set[i].chnl);
				unfollowThem.push(realB[index]);
				reals.splice(index,1);//remove from cache and options
				OptionsBackend.saveOption('real_channel',reals);
			}
		}
		else	//is friend	
			set[i].friend=true;
	}
	OptionsBackend.saveOption('defaultChannels',set);
	return unfollowThem;
}

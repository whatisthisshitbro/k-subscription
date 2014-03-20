K-SUBSCRIPTION ANONYMITY
==========
It's main purpose is to preserve user's anonymity when she browses Microblogging applications
(For now this extension can be used only for Twitter). The extension succeeds this
by obfuscating the user's preferences.

k-subscription anonymity extension uses Twitter API v1.1 and it works under the requirements 
of its REST API Rate Limit (see https://dev.twitter.com/docs/rate-limiting/1.1).
It is also written in Javascript and it uses JQuery, Json2, OAuth and Secure Hash Algorithm (SHA-1) 
libraries. Its User Interface is written in CSS and uses jquery-ui-1.7.2 library.


###INSTALLATION
In order to install this browser extension: 
- At first, extract the archive,
- open your Chrome browser 'Extensions' tab
- select Developer mode
- click at 'Load unpacked extension...'
- and then select the folder which contains your extracted extension
- finaly click at the k-subscription icon in tab bar and log in your
  twitter account in order to get the extension authorized to use your      
  account.


###HOW TO CHANGE THE DEFAULT SET WITH THE SENSITIVE CHANNELS
k-subscription anonymity extension includes a demo set with some example sensitive channels 
(see chnlsInfo.csv). If you want to change this set you can easily put your own sensitive set 
in a .csv (Comma-separated values) file, then run the ruby script "parseSet.rb" and give as 
argument the name of your file.
	e.g `ruby parseSet.rb <mySet.csv>`

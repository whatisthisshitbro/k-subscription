var SecretKeys = {
  twitter: {
    consumerSecret: 't1iVFqx9BfBbHTOabNb6LGn9jgYBklTu4qWWhFE',
    consumerKey: '4dMlR6uIeUHIpl9xh3VFQ'
  },

  hasValidKeys: function() {
    return (this.twitter.consumerSecret != '' && this.twitter.consumerKey != '');
  }
};
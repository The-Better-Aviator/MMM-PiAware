const NodeHelper = require('node_helper');
const axios = require('axios');

module.exports = NodeHelper.create({
  // This function will be executed when this loads and connects to module
  start: function () {
    console.log(this.name + ' started');
  },
  // This is used as a trigger from main module
  // sendSocketNotification returns a response to main module
  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case 'MMM_PIAWARE_RECEIVER':
        this.getData(payload, 'MMM_PIAWARE_RECEIVER_REC');
        break;
      case 'MMM_PIAWARE_AIRCRAFT':
        this.getData(payload, 'MMM_PIAWARE_AIRCRAFT_REC');
        break;
    }
  },
  apiCall: function (url, callback, method = null, headers = null) {
    var options = { method: method, headers: headers };
    axios
      .get(url, options)
      .then((res) => callback(res.data))
      .catch((err) => console.log(err));
  },
  getData: function (url, sendEvent) {
    this.apiCall(url, (res) => {
      this.sendSocketNotification(sendEvent, res);
    });
  },
});

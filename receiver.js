var local_receiver_peer;
function receiver_createPeer(cid) {
  local_receiver_peer = new SimplePeer({initiator: true, trickle: false});
  local_receiver_peer.on("signal", receiver_connection_data => {
    console.log("we have receiver rtcdata to send", receiver_connection_data);
    tx_receiverToSender(receiver_connection_data, cid);
  })
  local_receiver_peer.on('connect', () => {
    console.log("in receiver, and sender is connected");
  });
  local_receiver_peer.on('stream', stream => {
    console.log("receiving stream", stream);
    var videoElem = document.querySelector("video");
    videoElem.onloadedmetadata = function() {
      console.log('width is', this.videoWidth);
      console.log('height is', this.videoHeight);
      window.resizeTo(this.videoWidth, this.videoHeight);
    }
    videoElem.srcObject = stream;
  });
}

function gotRemoteSenderConnectionData(remote_sender_connection_data) {
  // it is possible that the peer isn't set up yet, so check and loop if not
  if (local_receiver_peer) {
    console.log("teaching receiver peer about remote sender");
    local_receiver_peer.signal(remote_sender_connection_data)
  } else {
    setTimeout(function() {
      gotRemoteSenderConnectionData(remote_sender_connection_data);
    }, 100);
  }
}

function rx_senderToReceiver(msg) {
  if (!msg.peerdata || msg.from != "sender") { return; }
  console.log("got incoming message in receiver", msg);
  gotRemoteSenderConnectionData(msg.peerdata);
}

function tx_receiverToSender(data, cid) {
  var msg = {channel: cid, message: {from: "receiver", peerdata: data}};
  console.log("Sending message from receiver to sender", msg);
  pubnub.publish(msg);
}

function receiver_listenToPubnub() {
  var cid = stuart_shortcode(3);
  console.log("cid is", cid);
  document.querySelector("#areceive .status").textContent = "code is " + cid;
  pubnub.addListener({
    message: function(m) {
      rx_senderToReceiver(m.message);
    },
    status: function(s) {
      console.log("got status in receiver", s);
      if (s.category === "PNConnectedCategory") {
        console.log("waiting for presence in receiver");
      }
    },
    presence: function(p) {
      console.log("got presence in receiver: number present =", p.occupancy);
      if (p.occupancy == 2) {
        console.log("both online! create peer");
        receiver_createPeer(cid);
      }
    }
  });
  pubnub.subscribe({channels: [cid], withPresence: true});
  console.log("Subscribe to pubnub");
}

document.querySelector('button[data-goto="receive"]').addEventListener("click", function() {
  receiver_listenToPubnub();
}, false);


document.querySelector('button[data-goto="receive"]').addEventListener("click", function() {
  return;
  var publishReadyCount = 0, publishReadyData;
  function readyToPublish(frm, from_receiver_rtcdata) {
    publishReadyCount += 1;
    console.log("publishReadyCount", publishReadyCount, "from", frm);
    if (from_receiver_rtcdata) publishReadyData = from_receiver_rtcdata;
    if (publishReadyCount == 2) {
      pubnub.publish({
        channel: cid,
        message: {
          from: "receiver",
          peerdata: publishReadyData
        }
      }, function(status, response) {
        console.log("published message with s, r", status, response);
      })
    }
  }

  var status = document.getElementById("status");
  function die() {
    document.body.dataset.screen = "choose";
  }
  var peer = new SimplePeer({initiator: true, trickle: false});
  peer.on("signal", data => {
    console.log("got signal data to send", from_receiver_rtcdata);
    readyToPublish("simplepeer", from_receiver_rtcdata);
  })
  peer.on('connect', () => {
    console.log("in receiver, and sender is connected");
  });
  peer.on('stream', stream => {
    var videoElem = document.querySelector("video");
    videoElem.srcObject = stream;
  });

}, false);

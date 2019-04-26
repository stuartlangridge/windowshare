const { desktopCapturer } = require('electron');

async function sendStream(stream) {
  console.log("sending stream");
  local_sender_peer.addStream(stream);
}

async function beginStream(sid) {
  console.log("Looking up stream", sid);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sid
      }
    }
  })
  console.log("now sending stream", stream);
  sendStream(stream);
}

async function displayWindowsToStream() {
  var frmul = document.querySelector("#senderform ul");
  desktopCapturer.getSources({ types: ['window'] }).then(async sources => {
    sources.sort((a,b) => a.name.localeCompare(b.name));
    sources.forEach(function(s) {
      var key = "chwin__" + s.id.replace(/[^a-z0-9]/gi, "__");
      var li = document.createElement("li");
      var img = document.createElement("img");
      var span = document.createElement("span");
      var inp = document.createElement("input");
      var lbl = document.createElement("label");
      inp.type = "radio";
      inp.id = key;
      inp.name = "chwin";
      lbl.htmlFor = key;
      span.textContent = s.name;
      img.src = s.thumbnail.toDataURL();
      inp.dataset.sourceid = s.id;
      lbl.appendChild(img);
      lbl.appendChild(span);
      li.appendChild(inp);
      li.appendChild(lbl);
      frmul.appendChild(li);
    })
  })
}

var local_sender_peer;
function sender_createPeer(cid) {
  local_sender_peer = new SimplePeer({trickle: false});
  local_sender_peer.on("signal", sender_connection_data => {
    console.log("we have sender rtcdata to send", sender_connection_data);
    tx_senderToReceiver(sender_connection_data, cid);
  })
  local_sender_peer.on('connect', () => {
    console.log("in sender, and receiver is connected");
    document.getElementById("asend").dataset.mode = "choose";
    document.getElementById("window").value = "Share selected window";
    displayWindowsToStream();
  });
}

function gotRemoteReceiverConnectionData(remote_receiver_connection_data) {
  // it is possible that the peer isn't set up yet, so check and loop if not
  if (local_sender_peer) {
    console.log("teaching sender peer about remote receiver");
    local_sender_peer.signal(remote_receiver_connection_data)
  } else {
    setTimeout(function() {
      gotRemoteReceiverConnectionData(remote_receiver_connection_data);
    }, 100);
  }
}

function rx_receiverToSender(msg) {
  if (!msg.peerdata || msg.from != "receiver") return;
  console.log("got incoming message in sender", msg);
  gotRemoteReceiverConnectionData(msg.peerdata);
}

function tx_senderToReceiver(data, cid) {
  var msg = {channel: cid, message: {from: "sender", peerdata: data}};
  console.log("Sending message from sender to receiver", msg);
  pubnub.publish(msg);
}

function sender_listenToPubnub(cid) {
  pubnub.addListener({
    message: function(m) {
      rx_receiverToSender(m.message);
    },
    status: function(s) {
      console.log("got status in sender", s);
      if (s.category === "PNConnectedCategory") {
        console.log("sender connected");
      }
    },
    presence: function(p) {
      console.log("got presence in sender: number present =", p.occupancy);
      if (p.occupancy == 2) {
        console.log("both online! create peer");
        sender_createPeer(cid);
      }
    }
  });
  pubnub.subscribe({channels: [cid], withPresence: true });
}

document.getElementById("senderform").onsubmit = function() {
  try {
    var cid = document.getElementById("code").value;
    if (cid && cid != "" && document.getElementById("asend").dataset.mode == "code") {
      sender_listenToPubnub(cid);
      document.getElementById("window").value = "confirming...";
    } else if (document.getElementById("asend").dataset.mode == "choose") {
      var chosen = Array.from(document.querySelectorAll('#asend ul input[type="radio"]')).filter(r => r.checked);
      if (chosen.length !== 1) return false;
      console.log("chosen is", chosen[0]);
      beginStream(chosen[0].dataset.sourceid.toString());
    }
    return false;
  } catch(e) {
    console.log("Caught problem while submitting");
    console.error(e);
    return false;
  }
}


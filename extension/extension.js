/*
    Copyright (C) 2017 Kai Uwe Broulik <kde@privat.broulik.de>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
 */

console.log("HALLO?");

var port
connectHost();

function connectHost() {
    port = chrome.runtime.connectNative("org.kde.plasma.chrome_integration");
}

port.onMessage.addListener(function (message) {
    console.log("PORT MESSAGE", message);
});

port.onDisconnect.addListener(function() {
  var error = chrome.runtime.lastError;

  console.log("Disconnected", error);

  chrome.notifications.create(null, {
      type: "basic",
      title: "Plasma Chrome Integration Error",
      message: "The native host disconnected unexpectedly: ",
      iconUrl: "icons/sad-face-128.png"
  });

  // TODO crash recursion guard
  connectHost();
});

//port.postMessage({MachstDu: "PARTY"});

/*var msgNr = 0;
setInterval(function() {
    console.log("POST MSG", msgNr);
    port.postMessage({msg: msgNr});
    ++msgNr;
}, 5000);*/

var currentPlayerTab;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.subsystem === "mpris") {
        switch (request.action) {
        case "play":
            currentPlayerTab = sender.tab;
            console.log("TAB", currentPlayerTab);
            port.postMessage({subsystem: "mpris", event: "play", title: currentPlayerTab.title});
            break;
        case "pause":
            port.postMessage({subsystem: "mpris", event: "pause"});
            break;
        }
    }
});



var kdeConnectMenu = chrome.contextMenus.create({
    id: "kdeconnect_page",
    contexts: ["link"],
    title: "Open on 'Nexus 5'",
});



chrome.windows.getAll({
    populate: true
}, function (windows) {
    console.log("CHROME WINS", windows);
});




var activeDownloads = []

setInterval(function() {
    chrome.downloads.search({
        state: 'in_progress',
        paused: false
    }, function (results) {
        if (!results.length) {
            return;
        }

        results.forEach(function (download) {
            if (activeDownloads.indexOf(download.id) === -1) {
                return;
            }

            var payload = {
                bytesReceived: download.bytesReceived
            };

            port.postMessage({subsystem: "downloads", event: "update", id: download.id, payload: payload});
        });
    });
}, 1000);

//chrome.downloads.setShelfEnabled(false);

chrome.downloads.onCreated.addListener(function (download) {
    var payload = {
        url: download.url,
        finalUrl: download.finalUrl,
        destination: download.filename,
        startTime: download.startTime,

        totalBytes: download.totalBytes,
        bytesReceived: download.bytesReceived
    };

    activeDownloads.push(download.id);

    port.postMessage({subsystem: "downloads", event: "created", id: download.id, payload: payload});
});

chrome.downloads.onChanged.addListener(function (delta) {
    if (activeDownloads.indexOf(delta.id) === -1) {
        console.log("ignoring download", delta.id, "that we didn't track");
    }

    var payload = {};

    if (delta.url) {
        payload.url = delta.url.current;
    }

    if (delta.filename) {
        payload.destination = delta.filename.current;
    }

    if (delta.state) {
        payload.state = delta.state.current;
    }

    if (delta.error) {
        payload.error = delta.error.current;
    }

    port.postMessage({subsystem: "downloads", event: "update", id: delta.id, payload: payload});
});

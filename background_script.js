// Global Variables - When possible pulling form Local Storage set via Options page.
var activeWindows = [];
var defaultTimeDelay = 10000;
var moverInteval;

if (localStorage["seconds"]) {
  defaultTimeDelay = (localStorage["seconds"] * 1000);
}

var tabReload = true;
if (localStorage["reload"]) {
  if (localStorage["reload"] == 'true') {
    tabReload = true;
  } else {
    tabReload = false;
  }
}

var tabInactive = false;
if (localStorage["inactive"]) {
  if (localStorage["inactive"] == 'true') {
    tabInactive = true;
  } else {
    tabInactive = false;
  }
}

var tabAutostart = false;
if (localStorage["autostart"]) {
  if (localStorage["autostart"] == 'true') {
    tabAutostart = true;
  } else {
    tabAutostart = false;
  }
}
var noRefreshList = [];
if (localStorage["noRefreshList"]) {
  noRefreshList = JSON.parse(localStorage["noRefreshList"]);
}

var tabIntervalList = [];
updateTabInterval();

function updateTabInterval() {
  if (localStorage["tabIntervalList"]) {
    tabIntervalList = localStorage["tabIntervalList"].split(',');
    tabIntervalList = tabIntervalList.map(function(value) {
      return value * 1000;
    });
  } else { tabIntervalList = []; }
  console.log("Tab specific time updated : " + tabIntervalList);
}

function include(arr, obj) {
  return (arr.indexOf(obj) != -1);
}

function activeInWindow(windowId) {
  for (i in activeWindows) {
    if (activeWindows[i] == windowId) {
      return true;
    }
  }
}

// Setup Initial Badge Text
var badgeColor = [139, 137, 137, 137];
chrome.browserAction.setBadgeBackgroundColor({
  color: badgeColor
});

// Called when the user clicks on the browser action.
chrome.browserAction.onClicked.addListener(function (tab) {
  var windowId = tab.windowId
  if (activeInWindow(windowId)) {
    stop(windowId);
  } else {
    go(tab);
  }
});

function badgeTabs(windowId, text) {
  chrome.tabs.getAllInWindow(windowId, function (tabs) {
    for (i in tabs) {
      switch (text) {
      case 'on':
        chrome.browserAction.setBadgeText({
          text: "\u2022"
        });
        chrome.browserAction.setBadgeBackgroundColor({
          color: [0, 255, 0, 100]
        });
        break;
      case '':
        chrome.browserAction.setBadgeText({
          text: "\u00D7"
        });
        chrome.browserAction.setBadgeBackgroundColor({
          color: [255, 0, 0, 100]
        });
        break;
      default:
        chrome.browserAction.setBadgeText({
          text: ""
        });
      }
    }
  });
}

// Start on a specific window
function go(tab) {
  windowId = tab.windowId;
  
  console.log("Tab Rotator - Started");
  scheduleSwitch(tab);

  activeWindows.push(windowId);
  badgeTabs(windowId, 'on');
}

function scheduleSwitch(tab) {
  console.log("Tab index : " + tab.index + ", Time : " + getTabTime(tab));
  moverInteval = setTimeout(function () {
    moveTabIfIdle(tab);
  }, getTabTime(tab));
}

// Stop on a specific window
function stop(windowId) {
  clearInterval(moverInteval);
  console.log('Tab Rotator - Stopped.');
  var index = activeWindows.indexOf(windowId);
  if (index >= 0) {
    activeWindows.splice(index);
    badgeTabs(windowId, '');
  }
}

// Switch Tab URL functionality.

function activateTab(tab) {
  if (tabReload && !include(noRefreshList, tab.url)) {
    // Trigger a reload
    chrome.tabs.update(tab.id, {
      url: tab.url,
      selected: tab.selected
    }, null);
    // Add a callback to swich tabs after the reload is complete
    chrome.tabs.onUpdated.addListener(
      function activateTabCallback(tabId, info) {
        if (info.status == "complete" && tabId == tab.id) {
          chrome.tabs.onUpdated.removeListener(activateTabCallback);
          selectTab(tab);
        }
      });
  } else {
    // Swich Tab right away
    selectTab(tab);
  }
}

function getTabTime(tab) {
  value = (tab.index < tabIntervalList.length) ? tabIntervalList[tab.index] : defaultTimeDelay;
  return isNaN(value) ? defaultTimeDelay : value;
}

function selectTab(tab) {
  chrome.tabs.update(tab.id, {
    selected: true
  });

  scheduleSwitch(tab);
}

// Call moveTab if the user isn't actually interacting with the browser

function moveTabIfIdle(tab) {
  if (tabInactive) {
    // 15 is the lowest allowable number of seconds for this call
    // If you try lower, Chrome complains
    chrome.idle.queryState(15, function (state) {
      if (state == 'idle') {
        moveTab();
      } else {
        //Set "wait" color and log.
        chrome.browserAction.setBadgeText({
          text: "\u2022"
        });
        chrome.browserAction.setBadgeBackgroundColor({
          color: [0, 0, 255, 100]
        });
        console.log('Browser was active, waiting.');
        scheduleSwitch(tab);
      }
    });
  } else {
    moveTab();
  }
}

// Switches to next URL in manifest, re-requests feed if at end of manifest.

function moveTab() {
  for (i in activeWindows) {
    windowId = activeWindows[i];
    badgeTabs(windowId, 'on');
    chrome.tabs.getSelected(windowId, function (currentTab) {
      chrome.tabs.getAllInWindow(currentTab.windowId, function (tabs) {
        nextTabIndex = 0;
        if (currentTab.index + 1 < tabs.length) {
          nextTabIndex = currentTab.index + 1;
        }
        activateTab(tabs[nextTabIndex]);
      });
    });
  }
}

//Autostart function, procesed on initial startup.
if (tabAutostart) {
  chrome.tabs.query({
      'active': true,
      'windowId': chrome.windows.WINDOW_ID_CURRENT
    },
    function (tabs) {
      //Start Revolver Tabs in main window.
      go(tabs[0]);
    }
  );
}
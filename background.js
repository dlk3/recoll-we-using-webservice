/*
 *      RecollWebext - WebExtension - Background Page
 *
 *      A lot of code was copied from or inspired by the savepage-WE
 *      extension.
 *
 *      Copyright (C) 2017 jfd@recoll.org
 *      Copyright (C) 2016-2017 DW-dev
 *
 *      Distributed under the GNU General Public License version 2
 *      See LICENCE.txt file and http://www.gnu.org/licenses/
 */

"use strict";

/* Global variables */

var isFirefox;
var ffVersion;

var showSubmenu;

var badgeTabId;

/* Initialize on browser startup */

isFirefox = (navigator.userAgent.indexOf("Firefox") >= 0);

chrome.storage.local.set({ "environment-isfirefox": isFirefox });

if (isFirefox) {
    chrome.runtime.getBrowserInfo(
        function(info) {
            ffVersion = info.version.substr(0,info.version.indexOf("."));
            initialize();
        });
} else {
    initialize();
}

function initialize()
{
    chrome.storage.local.get(null,
    function(object)
    {
        var context;
        var opt;
        
        /* Initialize or migrate options */
        var opdefaults = {"options-showsubmenu": true,
                          "options-autosave": true,
                          "options-httpsalso": true,
                          "options-notify": false,
                          "options-default-save": true,
                          "options-conflict-save": true
                         };
        for (opt in opdefaults) {
            if (!(opt in object)) {
                object[opt] = opdefaults[opt];
            }
        }
        
        /* Update stored options */
        chrome.storage.local.set(object);
        
        /* Initialize local options */
        showSubmenu = object["options-showsubmenu"];
        
        /* Add context menu items */
        context = showSubmenu ? "all" : "browser_action";
        
        chrome.contextMenus.create(
            {id: "indexnow", title: "Save this page for indexing",
             contexts: [ context ],  enabled: true });
        chrome.contextMenus.create(
            {id: "separator", type: "separator",
             contexts: [ context ], enabled: true });
        chrome.contextMenus.create(
            {id: "sitealways", title: "Always Index This Site",
             contexts: [ context ], enabled: true });
        chrome.contextMenus.create(
            {id: "sitenever", title: "Never Index This Site",
             contexts: [ context ], enabled: true });
        
        /* Set button and menu states */
        chrome.tabs.query({lastFocusedWindow: true, active: true },
                          function(tabs) {
                              setButtonAndMenuStates(tabs[0].id,tabs[0].url);
                          });
        
        /* Add listeners */
        addListeners();
    });
}

function addListeners()
{
    /* Storage changed listener */
    
    chrome.storage.onChanged.addListener(
    function(changes,areaName)
    {
        chrome.storage.local.get(null,
        function(object)
        {
            var context;
            
            showSubmenu = object["options-showsubmenu"];
            
            if ("options-showsubmenu" in changes)
            {
                context = showSubmenu ? "all" : "browser_action";
                chrome.contextMenus.update("indexnow",
                                           {contexts: [context]});
                chrome.contextMenus.update("separator",
                                           {contexts: [context]});
                chrome.contextMenus.update("sitealways",
                                           {contexts: [context]});
                chrome.contextMenus.update("sitenever",
                                           {contexts: [context]});
                
                chrome.tabs.query({ lastFocusedWindow: true, active: true },
                function(tabs)
                {
                    setButtonAndMenuStates(tabs[0].id,tabs[0].url);
                });
            }
        });
    });
    
    /* Browser action listener */
    chrome.browserAction.onClicked.addListener(
    function(tab)
    {
        initiateAction(tab, 0);
    });
    
    /* Context menu listener */
    chrome.contextMenus.onClicked.addListener(
    function(info,tab)
    {
        if (info.menuItemId == "indexnow") initiateAction(tab, 0,null);
        else if (info.menuItemId == "sitealways") initiateAction(tab, 1,null);
        else if (info.menuItemId == "sitenever") initiateAction(tab, 2,null);
    });
    
    /* Tab event listeners */
    chrome.tabs.onActivated.addListener(  /* tab selected */
    function(activeInfo)
    {
        chrome.tabs.get(activeInfo.tabId,
        function(tab)
        {
            setButtonAndMenuStates(activeInfo.tabId,tab.url);
        });
    });
    
    chrome.tabs.onUpdated.addListener(  /* URL updated */
    function(tabId,changeInfo,tab)
    {
        setButtonAndMenuStates(tabId,tab.url);
    });
    
    /* Message received listener */
    chrome.runtime.onMessage.addListener(
    function(message,sender,sendResponse)
    {
        var xhr = new Object();
        
        /* Messages from content script */
        
        switch (message.type)
        {
            case "downloadFile":
            {
                console.log("SAVEPAGE: Downloading " + message.location + " to " + message.filename);
                var downloading =  browser.downloads.download({filename: message.filename, url: message.location, saveAs: false });
                downloading.then(function() {console.log("Download started");}, function(reason) {console.log(reason);});
            }
            break;
            
            case "setSaveBadge":
            setSaveBadge(message.text,message.color);
            break;
        }
    });
}

function initiateAction(tab, menuaction, srcurl)
{
    if (specialPage(tab.url)) {
        alertNotify("Cannot be used with these special pages:\n" +
                    "about:, moz-extension:,\n" +
                    "https://addons.mozilla.org,\n" +
                    "chrome:, chrome-extension:,\n" +
                    "https://chrome.google.com/webstore.");
    } else {
        /* normal page - save operations allowed, saved page - all
           operations allowed */
        badgeTabId = tab.id;
        
        chrome.tabs.sendMessage(tab.id,
                                {type: "performAction",
                                 menuaction: menuaction, srcurl: srcurl},
        function(response)
        {
            if (chrome.runtime.lastError != null ||
                typeof response == "undefined") {
                /* no response received - content script not loaded in
                   active tab */
                chrome.tabs.executeScript(tab.id, {file: "content.js"},
                function()
                {
                    chrome.tabs.sendMessage(tab.id,{type: "performAction",
                                                    menuaction: menuaction,
                                                    srcurl: srcurl },
                    function(response)
                    {
                        if (chrome.runtime.lastError != null ||
                            typeof response == "undefined") {
                            /* no response received - content script
                               cannot be loaded in active tab*/
                            alertNotify("Cannot be used with this page.");
                        }
                    });
                });
            }
        });
    }
}

function specialPage(url)
{
    return (url.substr(0,6) == "about:" ||
            url.substr(0,14) == "moz-extension:" ||
            url.substr(0,26) == "https://addons.mozilla.org" ||
            url.substr(0,7) == "chrome:" ||
            url.substr(0,17) == "chrome-extension:" ||
            url.substr(0,34) == "https://chrome.google.com/webstore");
}

/* Set button and menu states function */
function setButtonAndMenuStates(tabId,url)
{
    if (specialPage(url)) {
        chrome.browserAction.disable(tabId);
        
        if (isFirefox && ffVersion <= 54) {
             /* Firefox 54- - icon not changed */
            chrome.browserAction.setIcon({tabId: tabId,
                                          path: "icon16-disabled.png"}); 
        }        
        chrome.browserAction.setTitle(
            {tabId: tabId,
             title: "Save Page WE - cannot be used with this page" });
        
        chrome.contextMenus.update("indexnow",{enabled: false });
        chrome.contextMenus.update("separator", {enabled: true });
        chrome.contextMenus.update("sitealways",{enabled: false });
        chrome.contextMenus.update("sitenever",{enabled: false });
    } else if (url.substr(0,5) == "file:") {
        chrome.browserAction.enable(tabId);
        
        if (isFirefox && ffVersion <= 54)
            chrome.browserAction.setIcon({ tabId: tabId, path: "icon16.png"});
        
        chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE" });
        
        chrome.contextMenus.update("indexnow",{enabled: true});
        chrome.contextMenus.update("separator", {enabled: true});
        chrome.contextMenus.update("sitealways",{enabled: false});
        chrome.contextMenus.update("sitenever",{enabled: false});
    } else {
        chrome.browserAction.enable(tabId);
        
        if (isFirefox && ffVersion <= 54)
            chrome.browserAction.setIcon({ tabId: tabId, path: "icon16.png"});
        
        chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE" });
        chrome.contextMenus.update("indexnow",{enabled: true});
        chrome.contextMenus.update("separator", {enabled: true});
        chrome.contextMenus.update("sitealways",{enabled: true});
        chrome.contextMenus.update("sitenever",{enabled: true});
    }
}

function setSaveBadge(text, color)
{
    chrome.browserAction.setBadgeText({tabId: badgeTabId, text: text});
    chrome.browserAction.setBadgeBackgroundColor({tabId: badgeTabId,
                                                  color: color});
}

function alertNotify(message)
{
    chrome.notifications.create(
        "alert",
        {type: "basic", iconUrl: "icon32.png", title: "SAVE PAGE WE",
         message: "" + message });
}

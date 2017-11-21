/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Background Page           */
/*                                                                      */
/*      Javascript for Background Page                                  */
/*                                                                      */
/*      Last Edit - 27 Oct 2017                                         */
/*                                                                      */
/*      Copyright (C) 2016-2017 DW-dev                                  */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENCE.txt file and http://www.gnu.org/licenses/           */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Refer to Google Chrome developer documentation:                     */
/*                                                                      */
/*  https://developer.chrome.com/extensions/overview                    */
/*  https://developer.chrome.com/extensions/content_scripts             */
/*  https://developer.chrome.com/extensions/messaging                   */
/*  https://developer.chrome.com/extensions/xhr                         */
/*  https://developer.chrome.com/extensions/contentSecurityPolicy       */
/*                                                                      */
/*  https://developer.chrome.com/extensions/manifest                    */
/*  https://developer.chrome.com/extensions/declare_permissions         */
/*  https://developer.chrome.com/extensions/match_patterns              */
/*                                                                      */
/*  https://developer.chrome.com/extensions/browserAction               */
/*  https://developer.chrome.com/extensions/contextMenus                */
/*  https://developer.chrome.com/extensions/downloads                   */
/*  https://developer.chrome.com/extensions/notifications               */
/*  https://developer.chrome.com/extensions/permissions                 */
/*  https://developer.chrome.com/extensions/runtime                     */
/*  https://developer.chrome.com/extensions/storage                     */
/*  https://developer.chrome.com/extensions/tabs                        */
/*                                                                      */
/*  Refer to IETF data uri and mime type documentation:                 */
/*                                                                      */
/*  RFC 2397 - https://tools.ietf.org/html/rfc2397                      */
/*  RFC 2045 - https://tools.ietf.org/html/rfc2045                      */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Notes on Save Page WE Operation                                     */
/*                                                                      */
/*  1. The basic approach is to traverse the DOM tree three times.      */
/*                                                                      */
/*  2. The current states of the HTML elements are extracted from       */
/*     the DOM tree. External resources are downloaded and scanned.     */
/*                                                                      */
/*  3. The first pass gathers external style sheet resources:           */
/*                                                                      */
/*     - <style> element: find style sheet url()'s in @import rules,    */
/*       then remember locations.                                       */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: find style sheet   */
/*       url()'s in @import rules, then remember locations.             */
/*                                                                      */
/*  4. After the first pass, the referenced external style sheets are   */
/*     downloaded from the remembered locations.                        */
/*                                                                      */
/*  5. The second pass gathers external script/font/image resources:    */
/*                                                                      */
/*     - <script> element: remember location from src attribute.        */
/*                                                                      */
/*     - <link rel="icon" href="..."> element: remember location        */
/*       from href attribute.                                           */
/*                                                                      */
/*     - <img> element: remember location from src attribute.           */
/*                                                                      */
/*     if just saving currently displayed CSS images:                   */
/*                                                                      */
/*     - all elements: find url()'s in CSS computed style for element   */
/*       and for before/after pseudo-elements and remember locations.   */
/*                                                                      */
/*     otherwise, if saving all CSS images:                             */
/*                                                                      */
/*     - style attribute on any element: find image url()'s in CSS      */
/*       rules and remember locations.                                  */
/*                                                                      */
/*     - <style> element: handle @import rules, then find font and      */
/*       image url()'s in CSS rules and remember locations.             */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: handle @import     */
/*       rules, then find font and image url()'s in CSS rules and       */
/*       remember locations.                                            */
/*                                                                      */
/*  6. After the second pass, the referenced external resources are     */
/*     downloaded from the remembered locations.                        */
/*                                                                      */
/*  7. The third pass generates HTML and data uri's:                    */
/*                                                                      */
/*     - style attribute on any element: replace image url()'s in       */
/*       CSS rules with data uri's.                                     */
/*                                                                      */
/*     - <script> element: Javascript is not changed.                   */
/*                                                                      */
/*     - <script src="..."> element: convert Javascript to data uri     */
/*       and use this to replace url in src attribute.                  */
/*                                                                      */
/*     - <style> element: handle @import rules, then replace font and   */
/*       image url()'s in CSS rules with data uri's.                    */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: handle @import     */
/*       rules, then replace font and image url()'s in CSS rules        */
/*       with data uri's, then enclose in new <style> element and       */
/*       replace original <link> element.                               */
/*                                                                      */
/*     - <link rel="icon" href="..."> element: convert icon to data     */
/*       uri and use this to replace url in href attribute.             */
/*                                                                      */
/*     - <base href="..." target="..."> element: remove existing        */
/*       base element (if any) and insert new base element with href    */
/*       attribute set to document.baseURI and target attribute set     */
/*       to the same value as for removed base element (if any).        */
/*                                                                      */
/*     - <body background="..."> element: convert image to data uri     */
/*       and use this to replace url in background attribute.           */
/*                                                                      */
/*     - <img src="..."> element: convert image to data uri and use     */
/*       this to replace url in src attribute.                          */
/*                                                                      */
/*     - <img srcset="..."> element: replace list of images by "".      */
/*                                                                      */
/*     - <input type="image" src="..."> element: convert image to       */
/*       data uri and use this to replace url in src attribute.         */
/*                                                                      */
/*     - <input type="file"> or <input type="password"> element:        */
/*       no changes made to maintain security.                          */
/*                                                                      */
/*     - <input type="checkbox"> or <input type="radio"> element:       */
/*       add or remove checked attribute depending on the value of      */
/*       element.checked reflecting any user changes.                   */
/*                                                                      */
/*     - <input type="-other-"> element: add value attribute set to     */
/*       element.value reflecting any user changes.                     */
/*                                                                      */
/*     - <audio src="..."> element: if current source, convert audio    */
/*       to data uri and use this to replace url in src attribute.      */
/*                                                                      */
/*     - <video src="..."> element: if current source, convert video    */
/*       to data uri and use this to replace url in src attribute.      */
/*                                                                      */
/*     - <video poster="..."> element: convert image to data uri and    */
/*       use this to replace url in poster attribute.                   */
/*                                                                      */
/*     - <source src="..."> element: if current source, convert audio   */
/*       or video to data uri and use this to replace url in src        */
/*       attribute.                                                     */
/*                                                                      */
/*     - <track src="..."> element: convert subtitles to data uri and   */
/*       use this to replace url in src attribute.                      */
/*                                                                      */
/*     - <object data="..."> element: convert binary data to data uri   */
/*       and use these to replace url in data attribute.                */
/*                                                                      */
/*     - <embed src="..."> element: convert binary data to data uri     */
/*       and use this to replace url in src attribute.                  */
/*                                                                      */
/*     - <frame src="..."> or <iframe src="..."> element: process       */
/*       sub-tree to extract HTML, then convert HTML to data uri and    */
/*       use this to replace url in src attribute.                      */
/*                                                                      */
/*     - other elements: process child nodes to extract HTML.           */
/*                                                                      */
/*     - text nodes: escape '<' and '>' characters.                     */
/*                                                                      */
/*     - comment nodes: enclose within <!-- and  -->                    */
/*                                                                      */
/*  8. Data URI syntax and defaults:                                    */
/*                                                                      */
/*     - data:[<media type>][;base64],<encoded data>                    */
/*                                                                      */
/*     - where <media type> is: <mime type>[;charset=<charset>]         */
/*                                                                      */
/*     - default for text content: text/plain;charset=US-ASCII          */
/*                                                                      */
/*     - default for binary content: application/octet-stream;base64    */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Potential Improvements                                              */
/*                                                                      */
/*  1. The main document and <frame> and <iframe> documents could be    */
/*     downloaded and scanned to extract the original states of the     */
/*     HTML elements, as an alternative to the current states.          */
/*                                                                      */
/*  2. <script src="..."> element could be converted to <script>        */
/*     element to avoid data uri in href attribute, which would also    */
/*     avoid using encodeURIComponent(), but any 'async' or 'defer'     */
/*     attributes would be lost and the order of execution of scripts   */
/*     could change.                                                    */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Handling of URL's in HTML Attributes                                */
/*                                                                      */
/*  Element         Attribute     HTML   Content        Handling        */
/*                                                                      */
/*  <a>             href          4 5    -              -               */
/*  <applet>        codebase      4      java           -               */
/*  <area>          href          4 5    -              -               */
/*  <audio>         src             5    audio          data uri   (1)  */
/*  <base>          href          4 5    -              -               */
/*  <blockquote>    cite          4 5    info           -               */
/*  <body>          background    4      image          data uri        */
/*  <button>        formaction      5    -              -               */
/*  <del>           cite          4 5    info           -               */
/*  <embed>         src             5    data           data uri        */
/*  <form>          action        4 5    -              -               */
/*  <frame>         longdesc      4      info           -               */
/*  <frame>         src           4      html           data uri        */
/*  <head>          profile       4      metadata       -               */
/*  <html>          manifest        5    -              -               */
/*  <iframe>        longdesc      4      info           -               */
/*  <iframe>        src           4 5    html           data uri        */
/*  <img>           longdesc      4      info           -               */
/*  <img>           src           4 5    image          data uri   (2)  */
/*  <img>           srcset          5    images         -          (2)  */
/*  <input>         formaction      5    -              -               */
/*  <input>         src           4 5    image          data uri        */
/*  <ins>           cite          4 5    info           -               */
/*  <link>          href          4 5    css            style      (3)  */
/*  <link>          href          4 5    icon           data uri        */
/*  <object>        archive       4      -              -               */
/*  <object>        classid       4      -              -               */
/*  <object>        codebase      4      -              -               */
/*  <object>        data          4 5    data           data uri        */
/*  <q>             cite          4 5    info           -               */
/*  <script>        src           4 5    javscript      data uri        */
/*  <source>        src             5    audio/video    data uri   (1)  */
/*  <track>         src             5    audio/video    data uri        */
/*  <video>         poster          5    image          data uri        */
/*  <video>         src             5    video          data uri   (1)  */
/*                                                                      */
/*  Notes:                                                              */
/*                                                                      */
/*  (1) data uri is created only if the URL in the 'src' attribute      */
/*      is the same as the URL in element.currentSrc of the related     */
/*      <audio> or <video> element.                                     */
/*                                                                      */
/*  (2) data uri is created for the URL in the 'src' attribute, but     */
/*      not for URL's in the 'srcset' attribute.                        */
/*                                                                      */
/*  (3) replace <link> element with <style> element containing the      */
/*      style sheet referred to by the URL in the 'href' attribute.     */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Handling of Binary Data and Characters                              */
/*                                                                      */
/*  1. Files downloaded by XMLHttpRequest GET request are received      */
/*     as a Uint8Array (8-bit unsigned integers) representing:          */
/*     - either binary data (image, font, audio or video)               */
/*     - or encoded characters (style sheets or scripts)                */
/*                                                                      */
/*  2. The Uint8Array is then converted to a Javascript string          */
/*     (16-bit unsigned integers) containing 8-bit unsigned values      */
/*     (a binary string) which is sent to the content script.           */
/*                                                                      */
/*  3. A binary string containing binary data is copied directly        */
/*     into the resourceContent store.                                  */
/*                                                                      */
/*  4. A binary string containing UTF-8 characters is converted to      */
/*     a normal Javascript string (containing UTF-16 characters)        */
/*     before being copied into the resourceContent store.              */
/*                                                                      */
/*  5. A binary string containing non-UTF-8 (ASCII, ANSI, ISO-8859-1)   */
/*     characters is copied directly into the resourceContent store.    */
/*                                                                      */
/*  6. When creating a Base64 data uri, the binary string from the      */
/*     resourceContent store is converted to a Base64 ASCII string      */
/*     using btoa().                                                    */
/*                                                                      */
/*  7. When creating a UTF-8 data uri, the UTF-16 string from the       */
/*     resourceContent store is converted to a UTF-8 %-escaped          */
/*     string using encodeURIComponent(). The following characters      */
/*     are not %-escaped: alphabetic, digits, - _ . ! ~ * ' ( )         */
/*                                                                      */
/*  8. Character encodings are determined as follows:                   */
/*     - UTF-8 Byte Order Mark (BOM) at the start of a text file        */
/*     - charset parameter in the HTTP Content-Type header field        */
/*     - @charset rule at the start of a style sheet                    */
/*     - charset attribute on an element referencing a text file        */
/*     - charset encoding of the parent document or style sheet         */
/*                                                                      */
/************************************************************************/

"use strict";

/************************************************************************/

/* Global variables */

var isFirefox;
var ffVersion;

var buttonAction;
var showSubmenu;

var badgeTabId;

/************************************************************************/

/* Initialize on browser startup */

isFirefox = (navigator.userAgent.indexOf("Firefox") >= 0);

chrome.storage.local.set({ "environment-isfirefox": isFirefox });

if (isFirefox)
{
    chrome.runtime.getBrowserInfo(
    function(info)
    {
        ffVersion = info.version.substr(0,info.version.indexOf("."));
        
        initialize();
    });
}
else initialize();

function initialize()
{
    chrome.storage.local.get(null,
    function(object)
    {
        var context;
        
        /* Initialize or migrate options */
        
        if (!("options-buttonaction" in object)) object["options-buttonaction"] =
            ("options-savebuttonaction" in object) ? object["options-savebuttonaction"] : 0;  /* Version 2.0-2.1 */
        
        if (!("options-showsubmenu" in object)) object["options-showsubmenu"] =
            ("options-showmenuitem" in object) ? object["options-showmenuitem"] : true;  /* Version 3.0-5.0 */
        
        if (!("options-showwarning" in object)) object["options-showwarning"] = true;
        
        if (!("options-showurllist" in object)) object["options-showurllist"] = false;
        
        if (!("options-prefixfilename" in object)) object["options-prefixfilename"] = false;
        
        if (!("options-suffixfilename" in object)) object["options-suffixfilename"] = false;
        
        if (!("options-usepageloader" in object)) object["options-usepageloader"] = true;
        
        if (!("options-removeunsavedurls" in object)) object["options-removeunsavedurls"] = true;
        
        if (!("options-includeinfobar" in object)) object["options-includeinfobar"] =
            ("options-includenotification" in object) ? object["options-includenotification"] : false;  /* Version 7.4 */
        
        
        if (!("options-includesummary" in object)) object["options-includesummary"] = false;
        
        if (!("options-savehtmlaudiovideo" in object)) object["options-savehtmlaudiovideo"] = false;
        
        if (!("options-savehtmlobjectembed" in object)) object["options-savehtmlobjectembed"] = false;
        
        if (!("options-savehtmlimagesall" in object)) object["options-savehtmlimagesall"] =
            ("options-saveallhtmlimages" in object) ? object["options-saveallhtmlimages"] : false;  /* Version 2.0-3.0 */
        
        if (!("options-savecssimagesall" in object)) object["options-savecssimagesall"] =
            ("options-saveallcssimages" in object) ? object["options-saveallcssimages"] : false;  /* Version 2.0-3.0 */
        
        if (!("options-savecssfontswoff" in object)) object["options-savecssfontswoff"] =
            ("options-saveallcustomfonts" in object) ? object["options-saveallcustomfonts"] : false;  /* Version 2.0-3.0 */
        
        if (!("options-savescripts" in object)) object["options-savescripts"] =
            ("options-saveallscripts" in object) ? object["options-saveallscripts"] : false;  /* Version 2.0-3.0 */
        
        if (!("options-maxframedepth" in object)) object["options-maxframedepth"] =
            ("options-saveframedepth" in object) ? object["options-saveframedepth"] : 2;  /* Version 2.0-2.1 */
        
        if (!("options-maxresourcesize" in object)) object["options-maxresourcesize"] = 50;
        
        /* Update stored options */
        
        chrome.storage.local.set(object);
        
        /* Initialize local options */
        
        buttonAction = object["options-buttonaction"];
        
        showSubmenu = object["options-showsubmenu"];
        
        /* Add context menu items */
        
        context = showSubmenu ? "all" : "browser_action";
        
        chrome.contextMenus.create({ id: "currentstate", title: "Save Current State", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "chosenitems", title: "Save Chosen Items", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "completepage", title: "Save Complete Page", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "separator", type: "separator", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "viewpageinfo", title: "View Saved Page Info", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "removepageloader", title: "Remove Page Loader", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "extractmedia", title: "Extract Image/Audio/Video", contexts: [ "image", "audio", "video" ], enabled: true });
        
        /* Set button and menu states */
        
        chrome.tabs.query({ lastFocusedWindow: true, active: true },
        function(tabs)
        {
            setButtonAndMenuStates(tabs[0].id,tabs[0].url);
        });
        
        /* Add listeners */
        
        addListeners();
    });
}

/************************************************************************/

/* Add listeners */

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
            
            buttonAction = object["options-buttonaction"];
            
            showSubmenu = object["options-showsubmenu"];
            
            if ("options-showsubmenu" in changes)
            {
                context = showSubmenu ? "all" : "browser_action";
                
                chrome.contextMenus.update("currentstate",{ contexts: [ context ] });
                chrome.contextMenus.update("chosenitems",{ contexts: [ context ] });
                chrome.contextMenus.update("completepage",{ contexts: [ context ] });
                chrome.contextMenus.update("separator", { contexts: [ context ] });
                chrome.contextMenus.update("viewpageinfo", { contexts: [ context ] });
                chrome.contextMenus.update("removepageloader", { contexts: [ context ] });
                chrome.contextMenus.update("extractmedia", { contexts: [ "image", "audio", "video" ] });
                
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
        initiateAction(tab,buttonAction);
    });
    
    /* Context menu listener */
    
    chrome.contextMenus.onClicked.addListener(
    function(info,tab)
    {
        if (info.menuItemId == "currentstate") initiateAction(tab,0,null);
        else if (info.menuItemId == "chosenitems") initiateAction(tab,1,null);
        else if (info.menuItemId == "completepage") initiateAction(tab,2,null);
        else if (info.menuItemId == "viewpageinfo") initiateAction(tab,3,null);
        else if (info.menuItemId == "removepageloader") initiateAction(tab,4,null);
        else if (info.menuItemId == "extractmedia") initiateAction(tab,5,info.srcUrl);
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
    
    /* Web navigation listeners */
    
    chrome.webNavigation.onCompleted.addListener(  /* page loaded or (Firefox) extracted resource downloaded */
    function(details)
    {
        if (details.frameId == 0)
        {
            /* If triggered by Extract Image/Audio/Video, details.url */
            /* will contain resource URL, so need to get page URL */ 
            
            chrome.tabs.get(details.tabId,
            function(tab)
            {
                setButtonAndMenuStates(details.tabId,tab.url);
                
                setSaveBadge("","#000000");
            });
        }
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
            
            case "loadResource":
                
                if (message.location.substr(0,6) == "https:" ||
                    (message.location.substr(0,5) == "http:" && message.pagescheme == "http:"))  /* block https: resource within http: page */
                { 
                    try
                    {
                        xhr = new XMLHttpRequest();
                        
                        xhr.open("GET",message.location,true);
                        xhr.setRequestHeader("Cache-Control","no-store");
                        xhr.responseType = "arraybuffer";
                        xhr.timeout = 10000;
                        xhr._tabId = sender.tab.id;
                        xhr._resourceIndex = message.index;
                        xhr.onload = onloadResource;
                        xhr.onerror = onerrorResource;
                        xhr.ontimeout = ontimeoutResource;
                        
                        xhr.send();  /* throws exception if url is invalid */
                    }
                    catch(e)
                    {
                        chrome.tabs.sendMessage(sender.tab.id,{ type: "loadFailure", index: message.index });
                    }
                }
                else chrome.tabs.sendMessage(sender.tab.id,{ type: "loadFailure", index: message.index });
                
                function onloadResource()
                {
                    var i,binaryString,contentType,allowOrigin;
                    var byteArray = new Uint8Array(this.response);
                    
                    if (this.status == 200)
                    {
                        binaryString = "";
                        for (i = 0; i < byteArray.byteLength; i++) binaryString += String.fromCharCode(byteArray[i]);
                        
                        contentType = this.getResponseHeader("Content-Type");
                        if (contentType == null) contentType = "";
                        
                        allowOrigin = this.getResponseHeader("Access-Control-Allow-Origin");
                        if (allowOrigin == null) allowOrigin = "";
                        
                        chrome.tabs.sendMessage(this._tabId,{ type: "loadSuccess", index: this._resourceIndex, content: binaryString, contenttype: contentType, alloworigin: allowOrigin });
                    }
                    else chrome.tabs.sendMessage(this._tabId,{ type: "loadFailure", index: this._resourceIndex });
                }
                
                function onerrorResource()
                {
                    chrome.tabs.sendMessage(this._tabId,{ type: "loadFailure", index: this._resourceIndex });
                }
                
                function ontimeoutResource()
                {
                    chrome.tabs.sendMessage(this._tabId,{ type: "loadFailure", index: this._resourceIndex });
                }
                
                break;
                
            case "setSaveBadge":
                
                setSaveBadge(message.text,message.color);
                
                break;
        }
    });
}

/************************************************************************/

/* Initiate action function */

function initiateAction(tab,menuaction,srcurl)
{
    if (specialPage(tab.url))  /* special page - no operations allowed */
    {
        alertNotify("Cannot be used with these special pages:\n" +
                    "about:, moz-extension:,\n" +
                    "https://addons.mozilla.org,\n" +
                    "chrome:, chrome-extension:,\n" +
                    "https://chrome.google.com/webstore.");
    }
    else if (tab.url.substr(0,5) != "file:" && menuaction >= 3)  /* probably not saved page - view saved page info and extract media operations not allowed */
    {
        alertNotify("Cannot view saved page information or extract media files for unsaved pages.");
    }
    else  /* normal page - save operations allowed, saved page - all operations allowed */
    {
        badgeTabId = tab.id;
        
        chrome.tabs.sendMessage(tab.id,{ type: "performAction", menuaction: menuaction, srcurl: srcurl },
        function(response)
        {
            if (chrome.runtime.lastError != null || typeof response == "undefined")  /* no response received - content script not loaded in active tab */
            {
                chrome.tabs.executeScript(tab.id,{ file: "content.js" },
                function()
                {
                    chrome.tabs.sendMessage(tab.id,{ type: "performAction", menuaction: menuaction, srcurl: srcurl },
                    function(response)
                    {
                        if (chrome.runtime.lastError != null || typeof response == "undefined")  /* no response received - content script cannot be loaded in active tab*/
                        {
                            alertNotify("Cannot be used with this page.");
                        }
                    });
                });
            }
        });
    }
}

/************************************************************************/

/* Special page function */

function specialPage(url)
{
    return (url.substr(0,6) == "about:" || url.substr(0,14) == "moz-extension:" || url.substr(0,26) == "https://addons.mozilla.org" ||
            url.substr(0,7) == "chrome:" || url.substr(0,17) == "chrome-extension:" || url.substr(0,34) == "https://chrome.google.com/webstore");
}

/************************************************************************/

/* Set button and menu states function */

function setButtonAndMenuStates(tabId,url)
{
    if (specialPage(url))  /* special page - disable all operations */
    {
        chrome.browserAction.disable(tabId);
        
        if (isFirefox && ffVersion <= 54) chrome.browserAction.setIcon({ tabId: tabId, path: "icon16-disabled.png"});  /* Firefox 54- - icon not changed */
        
        chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE - cannot be used with this page" });
        
        chrome.contextMenus.update("currentstate",{ enabled: false });
        chrome.contextMenus.update("chosenitems",{ enabled: false });
        chrome.contextMenus.update("completepage",{ enabled: false });
        chrome.contextMenus.update("separator", { enabled: true });
        chrome.contextMenus.update("viewpageinfo", { enabled: false });
        chrome.contextMenus.update("removepageloader", { enabled: false });
        if (showSubmenu) chrome.contextMenus.update("extractmedia", { contexts: [ "image", "audio", "video" ], enabled: false });
        else chrome.contextMenus.update("extractmedia", { contexts: [ "page_action" ], enabled: false });  /* never shown because there is no page action */
    }
    else if (url.substr(0,5) == "file:")  /* probably saved page - enable all operations */
    {
        chrome.browserAction.enable(tabId);
        
        if (isFirefox && ffVersion <= 54) chrome.browserAction.setIcon({ tabId: tabId, path: "icon16.png"});  /* Firefox 54- - icon not changed */
        
        chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE" });
        
        chrome.contextMenus.update("currentstate",{ enabled: true });
        chrome.contextMenus.update("chosenitems",{ enabled: true });
        chrome.contextMenus.update("completepage",{ enabled: true });
        chrome.contextMenus.update("separator", { enabled: true });
        chrome.contextMenus.update("viewpageinfo", { enabled: true });
        chrome.contextMenus.update("removepageloader", { enabled: true });
        chrome.contextMenus.update("extractmedia", { contexts: [ "image", "audio", "video" ], enabled: true });
    }
    else  /* normal page - enable save operations */
    {
        chrome.browserAction.enable(tabId);
        
        if (isFirefox && ffVersion <= 54) chrome.browserAction.setIcon({ tabId: tabId, path: "icon16.png"});  /* Firefox 54- - icon not changed */
        
        chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE" });
        
        chrome.contextMenus.update("currentstate",{ enabled: true });
        chrome.contextMenus.update("chosenitems",{ enabled: true });
        chrome.contextMenus.update("completepage",{ enabled: true });
        chrome.contextMenus.update("separator", { enabled: true });
        chrome.contextMenus.update("viewpageinfo", { enabled: false });
        chrome.contextMenus.update("removepageloader", { enabled: false });
        if (showSubmenu) chrome.contextMenus.update("extractmedia", { contexts: [ "image", "audio", "video" ], enabled: false });
        else chrome.contextMenus.update("extractmedia", { contexts: [ "page_action" ], enabled: false });  /* never shown because there is no page action */
    }
}

/************************************************************************/

/* Set save badge function */

function setSaveBadge(text,color)
{
    chrome.browserAction.setBadgeText({ tabId: badgeTabId, text: text });
    chrome.browserAction.setBadgeBackgroundColor({ tabId: badgeTabId, color: color });
}

/************************************************************************/

/* Display alert notification */

function alertNotify(message)
{
    chrome.notifications.create("alert",{ type: "basic", iconUrl: "icon32.png", title: "SAVE PAGE WE", message: "" + message });
}

/************************************************************************/

/* Display debug notification */

function debugNotify(message)
{
    chrome.notifications.create("debug",{ type: "basic", iconUrl: "icon32.png", title: "SAVE PAGE WE - DEBUG", message: "" + message });
}

function debugModal(message)
{
    chrome.tabs.query({ lastFocusedWindow: true, active: true },
    function(tabs)
    {
        chrome.tabs.executeScript(tabs[0].id,{ code: "alert('" + message + "');" });
    });
}

/************************************************************************/

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

var menuAction;
var autosave;
var httpsalso;

var htmlStrings = new Array();

/* Initialize on script load */
chrome.storage.local.get(
    null,
    function(object) {
        /* Load environment */
        isFirefox = object["environment-isfirefox"];
    
        /* Load options */
        autosave = object["options-autosave"];
        httpsalso = object["options-httpsalso"];
        
        addListeners();
});

/* Add listeners */

function addListeners()
{
    window.addEventListener(
        "load",
        function(event) {
            console.log("SAVEPAGE: document.readyState " + document.readyState);
            if (document.readyState == "complete") {
                console.log("SAVEPAGE: protocol " + document.location.protocol);
                if (autosave &&
                    (document.location.protocol == "http:" ||
                     (httpsalso && document.location.protocol == "https:"))) {
                    maybeSave();
                }
            }
        }, false);
    
    /* Storage changed listener */
    chrome.storage.onChanged.addListener(
    function(changes,areaName)
    {
        chrome.storage.local.get(null,
        function(object)
        {
            autosave = object["options-autosave"];
            httpsalso = object["options-httpsalso"];
        });
    });
    
    /* Message received listener */
    chrome.runtime.onMessage.addListener(
        function(message,sender,sendResponse)
        {
            var panel;
        
        switch (message.type) {
            /* Messages from background page */
            case "performAction":
            /* to confirm content script has been loaded */
            sendResponse({ });
                
            menuAction = message.menuaction;
                
            /* Wait for page to complete loading */
            if (document.readyState == "complete") {
                window.setTimeout(
                    function()
                    {
                        performAction(message.srcurl);
                    }, 50);
                } else {
                    window.addEventListener(
                        "load",
                        function(event)
                        {
                            if (document.readyState == "complete")
                                performAction(message.srcurl);
                        }, false);
                }
                
                break;
                
            case "loadSuccess":
            loadSuccess(message.index, message.content,
                        message.contenttype, message.alloworigin);
            break;
                
            case "loadFailure":
            loadFailure(message.index);
            break;
        }
    });
}

function performAction(srcurl)
{
    if (menuAction == 0) {
        /* Save page */
        htmlStrings.length = 0;
        doSave();
    }
}

/********************/
/* Copied from tested module in ../tested/wildcard.js */
function wildcard2RE(s)
{
    /* Quote some characters which are not special for wildcard exprs
       (or which we don't want to support), and are special for
       regexps */
    s = s.replace(/([\.\+\{\}\^\$])/g, "\\$1");

    /* Replace unescaped question marks with '.' and '*' with '.*'
       Note that this does not work if the backslash is itself
       escaped in the wildcard exp. Also we don't match / or : */
    s = s.replace(/(^|[^\\])\?/g, "$1[^/]").replace(/(^|[^\\])\*/g,"$1[^/]*")

    /* Replace '!' as first character of bracketed expr with '^' */
    s = s.replace(/(^|[^\\])\[!/g, "$1[^");

    /* Anchor expression */
    return "^" + s + "$";
}

function wildcardMatch(e, v)
{
    var re =  RegExp(wildcard2RE(e));
    /*console.log("RE: " + re + " V: [" + v + "] result: " + re.test(v))*/
    return re.test(v);
}
/* End copied code ***************/

function maybeSave()
{
    var location = document.location;
    
    console.log("SAVEPAGE: maybeSave. mtype " + document.contentType +
                " url " + document.location.href);

    /* We are only called from the automatic save after load situation, and 
       the protocol (http or https), and checks against
       autosave/httpsalso were performed in the listener.
       So we just need to check the url against the selection/exclusion lists.
    */

    var lists = ['recoll.exclude.list', 'recoll.include.list'];
    var flags = [false, false];
    var hostname = location.hostname;
    var href = location.href;
    for(var j = 0; j < 2; j++) {
        var list = JSON.parse(prefObject[lists[j]]);
        var len = list.length;
        var flag = false;
        for(var i = 0; i < len && !flag; i++) {
            var lpattern = list[i]['pattern'];
            switch(list[i]['patternType']) {
            case 'domain':
                // www.google.com matched by google.com and .com
                // www.agoogle.com not matched by google.com but matched by com
                // www.com.google. not matched by .com
                var pattern = lpattern;
                if (pattern[0] != '.')
                    pattern = "." + pattern;
                flag = hostname.endsWith(pattern) || (hostname == lpattern);
                console.log("Host match [" + lpattern + "] to [" +
                            hostname + "] -> " + flag);
                break;

            case 'wildcard':
                flag = wildcardMatch(lpattern, href);
                console.log("Wildcard match [" + lpattern + "] to [" + href +
                            "] -> " + flag);
                break;

            case 'regexp':
                var re = RegExp(list[i]['pattern']);
                flag = (href.match(re) != null)
                console.log("Regexp match [" + lpattern + "] to [" + href +
                            "] -> " + flag);
                break;
            default:
                this.debuglog("invalid rule" + list[i]);
                // something wrong;
                break;
            }
        }
        flags[j] = flag;
    }
    console.log("Should Index ? Exclude list match: " + flags[0] + 
                ". Include list match: " + flags[1]);

    // flags[0]: exclude. flags[1]: include
    if(!flags[0] && !flags[1])
        return prefObject['recoll.default.action'] == 1;
    if(flags[0] && flags[1])
        return prefObject['recoll.conflict.action'] == 1;
    return flags[1];

    doSave();
}

/* Return the content base file name for a given URL */
function getContentName(url)
{
    return "recoll-we-c-" + recoll_md5.hex_md5(url);
}

/* Return the metadata base file name path for a given url */
function getMetaName(url)
{
    return "recoll-we-m-" + recoll_md5.hex_md5(url);
}

function metadata(url, contentType, charset)
{
    var meta = [
        url + "\n",
        "WebHistory\n",
        contentType + "\n",
        "k:_unindexed:encoding=" + charset + "\n"
    ];
    return meta;
}

function downloadDataThroughLink(data, filename)
{
    var blob, objURL, link;
    function handleClick(event)
    {
        event.stopPropagation();
    }

    blob = new Blob(data, {type: "text/x-recoll-data"});
    objURL = window.URL.createObjectURL(blob);
    link = document.createElement("a");
    link.download = filename;
    link.href = objURL;
    console.log("SAVEPAGE: generate link click for filename " + filename +
                " href " + link.href);
    document.body.appendChild(link);
    link.addEventListener("click", handleClick, true);
    link.click();
    link.removeEventListener("click", handleClick, true);
    console.log("SAVEPAGE: clicked link");
    window.setTimeout(
        function() {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(objURL);
            chrome.runtime.sendMessage({type: "setSaveBadge",
                                        text: "", color: "#000000" });
        }, 200);
}

function doSave()
{
    var i,j,mimetype, filename

    console.log("SAVEPAGE: doSave");
    chrome.runtime.sendMessage({type: "setSaveBadge", text: "SAVE",
                                 color: "#0000E0" });

    /* Save metadata to file using HTML5 download attribute */
    let meta = metadata(document.location.href, document.contentType,
                        document.characterSet);
    filename = getMetaName(document.location.href);
    downloadDataThroughLink(meta, filename);

    if(document.contentType.match(/(text|html|xml)/i)) {
        /* Save data to file using HTML5 download attribute */
        htmlStrings.length = 0;
        htmlStrings[0] = document.documentElement.outerHTML;
        filename = getContentName(document.location.href);
        downloadDataThroughLink(htmlStrings, filename);
        htmlStrings.length = 0;
    } else {
        console.log("SAVEPAGE: send download message for " +
                    document.location.href + " filename " + filename);
        filename = getContentName(document.location.href);
        chrome.runtime.sendMessage({type: "downloadFile",
                                    location: document.location.href,
                                    filename: filename });
    }
}
